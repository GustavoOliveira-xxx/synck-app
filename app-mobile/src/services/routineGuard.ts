import type { OutboxOp } from '@/offline/outbox';
import { overlayPending } from '@/offline/outbox';
import { useDataStore } from '@/stores/dataStore';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { localToInstant, formatShortDate } from '@/utils/dates';
import { routineConflicts, type RoutineBlock } from '@/utils/routine';
import type { ConfirmOptions } from '@/components/Feedback';
import { saveRoutines } from './routines';

export class RoutineCancelled extends Error {}
let confirm: ((options: ConfirmOptions) => Promise<boolean | string>) | null = null;
export function registerRoutineConfirmation(handler: typeof confirm) {
  confirm = handler;
}

/** Um prazo com hora é um ponto; reservar duração continua sendo um bloco de evento. */
export async function guardRoutine(op: OutboxOp): Promise<void> {
  if (
    !['event', 'task'].includes(op.entity) ||
    !['create', 'update', 'split_series', 'exception_upsert', 'restore'].includes(op.kind)
  )
    return;
  const account = useAuthStore.getState().account;
  const periods = account?.preferences.routine_periods ?? [];
  if (!periods.some((p) => p.enabled)) return;
  const fields = op.kind === 'split_series' ? (op.payload.new_event as Record<string, unknown>) : op.payload;
  if (
    op.kind === 'update' &&
    !Object.keys(fields).some((k) =>
      ['starts_at', 'ends_at', 'due_date', 'due_time', 'timezone', 'recurrence_rule', 'all_day'].includes(k),
    )
  )
    return;
  if (
    op.kind === 'exception_upsert' &&
    ('status' in fields || !('starts_at' in fields || 'ends_at' in fields))
  )
    return;
  const previous =
    op.entity === 'event'
      ? overlayPending(useDataStore.getState().events, useSyncStore.getState().outbox, account?.id ?? null)[
          op.entityId
        ]
      : useDataStore.getState().tasks[op.entityId];
  const data = { ...previous, ...fields } as Record<string, unknown>;
  if (
    data.all_day ||
    data.is_cancelled ||
    ['cancelled', 'completed', 'archived'].includes(String(data.status))
  )
    return;
  let start: number, end: number;
  if (op.entity === 'task') {
    if (!data.due_date || !data.due_time) return;
    start = +localToInstant(String(data.due_date), String(data.due_time).slice(0, 5), String(data.timezone));
    end = start + 1;
  } else {
    start = Date.parse(String(data.starts_at));
    end = Date.parse(String(data.ends_at));
  }
  const context =
    fields.personal_context ??
    account?.contexts?.[op.entity + ':' + op.entityId] ??
    useSyncStore
      .getState()
      .outbox.find((o) => o.kind === 'create' && o.entity === op.entity && o.entityId === op.entityId)
      ?.payload.personal_context;
  const conflicts = routineConflicts(periods, start, end).filter(
    (b) => !(context !== 'custom' && b.period.kind === context && b.start <= start && b.end >= end),
  );
  const recurring = !!data.recurrence_rule && op.kind !== 'exception_upsert';
  // Uma série ilimitada não é declarada livre com base apenas no primeiro dia.
  if (!conflicts.length && (!recurring || periods.every((p) => !p.enabled || p.kind === context))) return;
  if (!confirm) throw new RoutineCancelled('Confira a rotina antes de continuar.');
  const describe = (b: RoutineBlock) => b.period.title + ' (' + formatShortDate(b.date) + ')';
  const choice = await confirm({
    title: conflicts.length ? 'Este horário encontra sua rotina' : 'Conferir a rotina da série',
    message:
      (conflicts.length ? conflicts.map(describe).join(', ') + '. ' : '') +
      (recurring
        ? 'Esta alteração cria ou modifica uma série. A rotina pode coincidir com outras ocorrências, inclusive no futuro. Confira a agenda; liberar um único dia não libera toda a série.'
        : 'Escolha outro horário, libere apenas esta ocorrência da rotina ou confirme um encaixe. O padrão semanal permanece.'),
    cancelLabel: 'Escolher outro horário',
    confirmLabel: 'Manter os dois',
    choices:
      !recurring && conflicts.length
        ? [
            { value: 'skip', label: 'Liberar só estas ocorrências' },
            { value: 'keep', label: 'Manter os dois' },
          ]
        : undefined,
  });
  if (!choice) throw new RoutineCancelled('Horário não alterado.');
  if (choice === 'skip') {
    const next = periods.map((p) => {
      const dates = new Set(conflicts.filter((b) => b.period.id === p.id).map((b) => b.date));
      return dates.size
        ? {
            ...p,
            exceptions: [
              ...(p.exceptions ?? []).filter((e) => !dates.has(e.original_date)),
              ...[...dates].map((original_date) => ({ original_date, action: 'skip' as const })),
            ],
          }
        : p;
    });
    await saveRoutines(next, periods);
  }
}
