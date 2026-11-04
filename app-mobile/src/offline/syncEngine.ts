import { guardRoutine } from '@/services/routineGuard';
// Motor de sincronização.
//
// Quando a conexão volta (ou a cada alteração, se houver internet):
//  1. confere a sessão (login);
//  2. envia as operações pendentes, na ordem;
//  3. processa as respostas (sucesso, conflito, erro);
//  4. atualiza o cache com os dados do servidor;
//  5. tenta mesclar conflitos; o que não der, fica para a pessoa decidir;
//  6. remove operações concluídas;
//  7. marca as que falharam (com nova tentativa automática quando faz sentido);
//  8. a tela de Sincronização permite tentar de novo manualmente.
import * as api from '@/services/api';
import { logError } from '@/services/errorLog';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import type { Account, CalendarEvent, DateKey, EventFields, MyItems } from '@/models/types';
import { errorCode, isNetworkError } from '@/utils/errors';

import { DUE_GROUP, mergeFields, threeWayMerge, TIME_GROUP } from './merge';
import {
  enqueue,
  markConflict,
  markFailed,
  readyOps,
  recoverInterrupted,
  removeOp,
  updateOp,
  type OutboxOp,
} from './outbox';
import { newId, readJSON, storageKeys, writeJSON } from './storage';

/** Janela de eventos mantida no aparelho: 2 meses para trás e 13 para frente. */
export function defaultWindow(now: Date = new Date()): { from: Date; to: Date } {
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 13, 1);
  return { from, to };
}

const uid = () => useAuthStore.getState().session?.user.id ?? null;

// ---------------------------------------------------------------------
// Persistência local
// ---------------------------------------------------------------------

export async function loadLocalState(userId: string): Promise<void> {
  const [calendars, events, members, window, notifications, outbox, account, meta, items] = await Promise.all(
    [
      readJSON(storageKeys.calendars(userId), []),
      readJSON(storageKeys.events(userId), {}),
      readJSON(storageKeys.members(userId), {}),
      readJSON(storageKeys.window(userId), null),
      readJSON(storageKeys.notifications(userId), []),
      readJSON<OutboxOp[]>(storageKeys.outbox(userId), []),
      readJSON<Account | null>(storageKeys.account(userId), null),
      readJSON<{ lastSyncAt: string | null }>(storageKeys.syncMeta(userId), { lastSyncAt: null }),
      readJSON<StoredItems | null>(storageKeys.items(userId), null),
    ],
  );
  useDataStore.getState().set({
    calendars,
    events,
    members,
    window,
    notifications,
    ...(items ?? {}),
    hydrated: true,
  });
  // Se o app fechou no meio de um envio, a operação volta para a fila.
  useSyncStore.getState().patch({ outbox: recoverInterrupted(outbox), lastSyncAt: meta.lastSyncAt });
  if (account) useAuthStore.getState().setAccount(account);
}

/** Tarefas, listas, anotações, hábitos e dias planejados, gravados juntos. */
type StoredItems = Pick<
  ReturnType<typeof useDataStore.getState>,
  'tasks' | 'lists' | 'notes' | 'habits' | 'checkins'
>;

export async function persistData(userId: string): Promise<void> {
  const s = useDataStore.getState();
  const items: StoredItems = {
    tasks: s.tasks,
    lists: s.lists,
    notes: s.notes,
    habits: s.habits,
    checkins: s.checkins,
  };
  await Promise.all([
    writeJSON(storageKeys.items(userId), items),
    writeJSON(storageKeys.calendars(userId), s.calendars),
    writeJSON(storageKeys.events(userId), s.events),
    writeJSON(storageKeys.members(userId), s.members),
    writeJSON(storageKeys.window(userId), s.window),
    writeJSON(storageKeys.notifications(userId), s.notifications),
  ]);
}

async function setOutbox(next: OutboxOp[]): Promise<void> {
  useSyncStore.getState().setOutbox(next);
  const id = uid();
  if (id) await writeJSON(storageKeys.outbox(id), next);
}

// ---------------------------------------------------------------------
// Fila
// ---------------------------------------------------------------------

/** Adiciona uma operação à fila e dispara o envio. */
export async function enqueueOp(op: OutboxOp): Promise<void> {
  await guardRoutine(op);
  await setOutbox(enqueue(useSyncStore.getState().outbox, op));
  requestSync({ pull: false });
}

export async function retryOperation(id: string): Promise<void> {
  const op = useSyncStore.getState().outbox.find((o) => o.id === id);
  if (!op) return;
  // Erros definitivos ficam registrados no servidor para aquele id; uma nova
  // tentativa manual precisa de um id novo. Falhas de rede reutilizam o id.
  const transient =
    !op.lastError || ['NETWORK', 'TIMEOUT', 'UNKNOWN', 'NOT_AUTHENTICATED'].includes(op.lastError);
  await setOutbox(
    updateOp(useSyncStore.getState().outbox, id, {
      id: transient ? op.id : newId(),
      status: 'pending',
      nextAttemptAt: null,
      lastError: null,
    }),
  );
  requestSync({ pull: false });
}

export async function discardOperation(id: string): Promise<void> {
  await setOutbox(removeOp(useSyncStore.getState().outbox, id));
}

export async function replaceOperation(id: string, changes: Partial<OutboxOp>): Promise<void> {
  await setOutbox(updateOp(useSyncStore.getState().outbox, id, changes));
  requestSync({ pull: false });
}

// ---------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------

function mergeServerEvent(server: Partial<CalendarEvent>): void {
  if (!server.id) return;
  const current = useDataStore.getState().events[server.id];
  const defaults = { exceptions: [], attendee_ids: [], my_reminders: [], is_masked: false };
  const merged = (current ? { ...current, ...server } : { ...defaults, ...server }) as CalendarEvent;
  if (server.deleted_at) {
    const events = { ...useDataStore.getState().events };
    delete events[server.id];
    useDataStore.getState().set({ events });
  } else {
    useDataStore.getState().upsertEvents([merged]);
  }
}

function pick(source: Partial<CalendarEvent>, keys: string[]): Partial<EventFields> {
  return Object.fromEntries(
    keys.map((k) => [k, source[k as keyof CalendarEvent] ?? null]),
  ) as Partial<EventFields>;
}

const STORE_KIND = { task: 'tasks', list: 'lists', note: 'notes', habit: 'habits' } as const;

function originOf(op: OutboxOp): 'app' | 'offline_sync' {
  // Operações que esperaram na fila (sem internet) são marcadas como sincronização offline.
  return op.attempts > 0 || Date.now() - new Date(op.createdAt).getTime() > 60_000 ? 'offline_sync' : 'app';
}

function countMetric(key: 'sent' | 'failed' | 'conflicts'): void {
  const metrics = useSyncStore.getState().metrics;
  useSyncStore.getState().patch({ metrics: { ...metrics, [key]: metrics[key] + 1 } });
}

/** Tarefas, listas, anotações, hábitos e plano do dia: mesmo ciclo dos eventos. */
async function processItemOp(op: OutboxOp): Promise<'continue' | 'stop'> {
  const res = await api.applyItemOp({
    opId: op.id,
    entity: op.entity,
    kind: op.kind,
    id: op.entityId,
    payload: op.payload,
    baseVersion: op.baseVersion,
    origin: originOf(op),
  });
  const kind = op.entity in STORE_KIND ? STORE_KIND[op.entity as keyof typeof STORE_KIND] : null;
  const item = (res.task ?? res.list ?? res.note ?? res.habit) as
    ({ id: string; version?: number; deleted_at?: string | null } & Record<string, unknown>) | undefined;

  if (res.status === 'conflict' && item && kind) {
    useDataStore.getState().upsertItems(kind, [item]);
    countMetric('conflicts');
    if (op.kind === 'update' && res.reason === 'version' && op.baseSnapshot) {
      const merge = mergeFields(
        op.baseSnapshot,
        op.payload,
        item,
        op.entity === 'task' ? DUE_GROUP : [],
        'due',
      );
      if (merge.conflicts.length === 0) {
        const keys = Object.keys(merge.payload);
        await setOutbox(
          keys.length === 0
            ? removeOp(useSyncStore.getState().outbox, op.id)
            : updateOp(useSyncStore.getState().outbox, op.id, {
                status: 'pending',
                payload: merge.payload,
                baseVersion: item.version ?? null,
                baseSnapshot: Object.fromEntries(keys.map((k) => [k, item[k] ?? null])),
              }),
        );
        return 'continue';
      }
      await setOutbox(
        markConflict(useSyncStore.getState().outbox, op.id, {
          reason: 'version',
          server: item,
          fields: merge.conflicts,
        }),
      );
      return 'continue';
    }
    await setOutbox(
      markConflict(useSyncStore.getState().outbox, op.id, {
        reason: res.reason ?? 'version',
        server: item,
        fields: Object.keys(op.payload),
      }),
    );
    return 'continue';
  }

  if (res.status === 'error') {
    const code = res.code ?? 'UNKNOWN';
    if (code === 'NOT_FOUND' && op.kind !== 'create' && kind) {
      // O item sumiu (excluído ou acesso removido): não há o que enviar.
      useDataStore.getState().upsertItems(kind, [{ id: op.entityId, deleted_at: new Date().toISOString() }]);
      await setOutbox(removeOp(useSyncStore.getState().outbox, op.id));
      return 'continue';
    }
    countMetric('failed');
    await setOutbox(markFailed(useSyncStore.getState().outbox, op.id, code, false));
    return 'continue';
  }

  if (item && kind) useDataStore.getState().upsertItems(kind, [item]);
  if (op.entity === 'checkin') {
    const day = op.payload.day as DateKey;
    const current = useDataStore.getState().checkins;
    if (!current.includes(day)) useDataStore.getState().set({ checkins: [day, ...current] });
  }
  await setOutbox(removeOp(useSyncStore.getState().outbox, op.id));
  countMetric('sent');
  return 'continue';
}

async function processOp(op: OutboxOp): Promise<'continue' | 'stop'> {
  const sync = useSyncStore.getState();
  await setOutbox(
    updateOp(sync.outbox, op.id, { status: 'syncing', lastAttemptAt: new Date().toISOString() }),
  );
  try {
    if (op.entity && op.entity !== 'event') {
      return await processItemOp(op);
    }
    if (op.kind === 'reminders_set') {
      await api.setEventReminders(op.entityId, op.payload.minutes as number[]);
    } else if (op.kind === 'attendees_set') {
      await api.setEventAttendees(op.entityId, op.payload.user_ids as string[]);
    } else {
      const res = await api.applyEventOp({
        opId: op.id,
        kind: op.kind,
        eventId: op.entityId,
        payload: op.payload,
        baseVersion: op.baseVersion,
        origin: originOf(op),
      });

      if (res.status === 'conflict' && res.event) {
        mergeServerEvent(res.event);
        const metrics = useSyncStore.getState().metrics;
        useSyncStore.getState().patch({ metrics: { ...metrics, conflicts: metrics.conflicts + 1 } });
        if (op.kind === 'update' && res.reason === 'version' && op.baseSnapshot) {
          const merge = threeWayMerge(
            op.baseSnapshot as Partial<EventFields>,
            op.payload as Partial<EventFields>,
            res.event,
          );
          if (merge.conflicts.length === 0) {
            const keys = Object.keys(merge.payload);
            if (keys.length === 0) {
              await setOutbox(removeOp(useSyncStore.getState().outbox, op.id));
            } else {
              // Mesclou sozinho: reenvia só o que sobrou, sobre a versão nova.
              const timeKeys = keys.some((k) => (TIME_GROUP as string[]).includes(k))
                ? (TIME_GROUP as string[])
                : [];
              await setOutbox(
                // O servidor não guarda conflitos, então o mesmo id pode ser reenviado.
                updateOp(useSyncStore.getState().outbox, op.id, {
                  status: 'pending',
                  payload: merge.payload,
                  baseVersion: res.event.version ?? null,
                  baseSnapshot: pick(res.event, [...new Set([...keys, ...timeKeys])]) as Record<
                    string,
                    unknown
                  >,
                }),
              );
            }
            return 'continue';
          }
          await setOutbox(
            markConflict(useSyncStore.getState().outbox, op.id, {
              reason: 'version',
              server: res.event as Record<string, unknown>,
              fields: merge.conflicts,
            }),
          );
          return 'continue';
        }
        await setOutbox(
          markConflict(useSyncStore.getState().outbox, op.id, {
            reason: res.reason ?? 'version',
            server: res.event as Record<string, unknown>,
            fields: Object.keys(op.payload),
          }),
        );
        return 'continue';
      }

      if (res.status === 'error') {
        const code = res.code ?? 'UNKNOWN';
        if (
          code === 'NOT_FOUND' &&
          (op.kind === 'update' || op.kind === 'delete' || op.kind === 'exception_upsert')
        ) {
          // O evento sumiu (excluído ou acesso removido): não há o que enviar.
          const events = { ...useDataStore.getState().events };
          delete events[op.entityId];
          useDataStore.getState().set({ events });
          await setOutbox(removeOp(useSyncStore.getState().outbox, op.id));
          return 'continue';
        }
        const metrics = useSyncStore.getState().metrics;
        useSyncStore.getState().patch({ metrics: { ...metrics, failed: metrics.failed + 1 } });
        await setOutbox(markFailed(useSyncStore.getState().outbox, op.id, code, false));
        return 'continue';
      }

      if (res.event) mergeServerEvent(res.event);
      if (res.new_event) mergeServerEvent(res.new_event);
      if (op.kind === 'delete') mergeServerEvent({ id: op.entityId, deleted_at: new Date().toISOString() });
    }

    await setOutbox(removeOp(useSyncStore.getState().outbox, op.id));
    const metrics = useSyncStore.getState().metrics;
    useSyncStore.getState().patch({ metrics: { ...metrics, sent: metrics.sent + 1 } });
    return 'continue';
  } catch (error) {
    const code = errorCode(error);
    await setOutbox(markFailed(useSyncStore.getState().outbox, op.id, code, true));
    if (isNetworkError(error)) {
      useSyncStore.getState().setOnline(false);
      return 'stop';
    }
    if (code === 'NOT_AUTHENTICATED') {
      useSyncStore.getState().patch({ authRequired: true });
      return 'stop';
    }
    await logError('sync.push', error);
    return 'continue';
  }
}

async function pushOutbox(): Promise<void> {
  for (let round = 0; round < 200; round++) {
    const ops = readyOps(useSyncStore.getState().outbox);
    if (ops.length === 0) return;
    for (const op of ops) {
      if ((await processOp(op)) === 'stop') return;
    }
  }
}

// ---------------------------------------------------------------------
// Recebimento
// ---------------------------------------------------------------------

async function pullAll(userId: string): Promise<void> {
  const data = useDataStore.getState();
  const calendars = await api.listMyCalendars();
  const ids = new Set(calendars.map((c) => c.id));
  // Regra 10 do convite: quem perdeu acesso não fica com dados antigos no cache.
  for (const old of data.calendars) if (!ids.has(old.id)) useDataStore.getState().removeCalendar(old.id);
  useDataStore.getState().set({ calendars });

  const active = calendars.filter((c) => !c.deleted_at).map((c) => c.id);
  const base = defaultWindow();
  const current = useDataStore.getState().window;
  const from = current && new Date(current.from) < base.from ? new Date(current.from) : base.from;
  const to = current && new Date(current.to) > base.to ? new Date(current.to) : base.to;
  const events = active.length ? await api.listEvents(active, from, to) : [];
  useDataStore.getState().set({
    events: Object.fromEntries(events.map((e) => [e.id, e])),
    window: { from: from.toISOString(), to: to.toISOString() },
  });

  const [notifications, account, items] = await Promise.all([
    api.listNotifications(100),
    api.getMyAccount(),
    api.listMyItems(),
  ]);
  useDataStore.getState().set({ notifications, ...itemsToState(items) });
  useAuthStore.getState().setAccount(account);
  await writeJSON(storageKeys.account(userId), account);
  await persistData(userId);
}

function byId<T extends { id: string }>(list: T[]): Record<string, T> {
  return Object.fromEntries(list.map((x) => [x.id, x]));
}

export function itemsToState(items: MyItems): StoredItems {
  return {
    tasks: byId(items.tasks ?? []),
    lists: byId(items.lists ?? []),
    notes: byId(items.notes ?? []),
    habits: byId(items.habits ?? []),
    checkins: items.checkins ?? [],
  };
}

/** Garante que eventos de um período (ex.: navegou para outro ano) estejam carregados. */
export async function ensureRange(from: Date, to: Date): Promise<void> {
  const userId = uid();
  const data = useDataStore.getState();
  if (!userId || !useSyncStore.getState().online || !data.window) return;
  if (new Date(data.window.from) <= from && new Date(data.window.to) >= to) return;
  try {
    const active = data.calendars.filter((c) => !c.deleted_at).map((c) => c.id);
    const newFrom = new Date(Math.min(from.getTime(), new Date(data.window.from).getTime()));
    const newTo = new Date(Math.max(to.getTime(), new Date(data.window.to).getTime()));
    const events = active.length ? await api.listEvents(active, from, to) : [];
    useDataStore.getState().upsertEvents(events);
    useDataStore.getState().set({ window: { from: newFrom.toISOString(), to: newTo.toISOString() } });
    await persistData(userId);
  } catch (error) {
    if (!isNetworkError(error)) await logError('sync.range', error);
  }
}

// ---------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------

type AfterSyncHook = () => Promise<void> | void;
let afterSync: AfterSyncHook | null = null;

/** Registrado pela sessão: ex.: reagendar lembretes depois de sincronizar. */
export function setAfterSyncHook(hook: AfterSyncHook | null): void {
  afterSync = hook;
}

let running: Promise<void> | null = null;
let queued: { pull: boolean } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export function requestSync(options: { pull?: boolean } = {}): void {
  const pull = options.pull ?? true;
  queued = { pull: (queued?.pull ?? false) || pull };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, 400);
}

export async function syncNow(): Promise<void> {
  if (running) {
    queued = queued ?? { pull: true };
    return running;
  }
  const options = queued ?? { pull: true };
  queued = null;
  running = (async () => {
    const userId = uid();
    const sync = useSyncStore.getState();
    if (!userId || !sync.online) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      sync.patch({ authRequired: true });
      return;
    }
    const started = Date.now();
    sync.patch({ syncing: true, authRequired: false });
    try {
      await pushOutbox();
      if (options.pull && useSyncStore.getState().online) await pullAll(userId);
      else await persistData(userId);
      const now = new Date().toISOString();
      useSyncStore.getState().patch({ lastSyncAt: now, lastError: null });
      await writeJSON(storageKeys.syncMeta(userId), { lastSyncAt: now });
      if (afterSync) await afterSync();
    } catch (error) {
      if (isNetworkError(error)) useSyncStore.getState().setOnline(false);
      else await logError('sync', error);
      useSyncStore.getState().patch({ lastError: errorCode(error) });
    } finally {
      const metrics = useSyncStore.getState().metrics;
      useSyncStore
        .getState()
        .patch({ syncing: false, metrics: { ...metrics, lastDurationMs: Date.now() - started } });
    }
  })();
  try {
    await running;
  } finally {
    running = null;
    if (queued) requestSync(queued);
  }
}
