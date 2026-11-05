// Lembretes como notificações LOCAIS: agendadas no próprio celular, funcionam
// sem internet e com o app fechado. A cada sincronização, todos os lembretes
// são recriados do zero (evita duplicidade e cobre evento alterado, cancelado,
// série recorrente, troca de fuso e troca de aparelho). Os adiamentos ficam
// guardados no aparelho e voltam a ser agendados junto.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';

import { t } from '@/i18n';
import { marca } from '@/theme/marca';
import { storageKeys } from '@/offline/storage';
import type { NotificationPreferences, Occurrence, Task, TimeFormat } from '@/models/types';
import { formatOccurrenceTime, isWithinQuietHours, todayKey } from '@/utils/dates';
import { reminderTitle } from '@/utils/reminders';
import { alertBase, describeDue, isOpen } from '@/utils/tasks';

import { logError } from './errorLog';

const CHANNEL_PRIVATE = 'lembretes';
const CHANNEL_PUBLIC = 'lembretes-detalhes';
const CHANNEL_QUIET = 'lembretes-silencio';
/** Categoria com os botões "Abrir" e "Adiar 10 min". */
export const REMINDER_CATEGORY = 'lembrete';
/** Tarefas e lembretes: "Abrir", "Concluir" e "Adiar 10 min". */
export const TASK_CATEGORY = 'tarefa';
export const ACTION_OPEN = 'abrir';
export const ACTION_SNOOZE = 'adiar';
export const ACTION_DONE = 'concluir';
export const SNOOZE_MINUTES = 10;
export { reminderTitle };
const HORIZON_DAYS = 30;
const MAX_SCHEDULED = 60;

export const notificationsSupported = Platform.OS !== 'web';

export function configureNotifications(): void {
  if (!notificationsSupported) return;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: notification.request.content.data?.silent !== true,
      shouldSetBadge: false,
    }),
  });
}

/** Botões das notificações de lembrete. */
async function ensureCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
    {
      identifier: ACTION_OPEN,
      buttonTitle: t('reminders.actionOpen'),
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: t('reminders.actionSnooze'),
      options: { opensAppToForeground: true },
    },
  ]).catch(() => undefined);
  await Notifications.setNotificationCategoryAsync(TASK_CATEGORY, [
    {
      identifier: ACTION_OPEN,
      buttonTitle: t('reminders.actionOpen'),
      options: { opensAppToForeground: true },
    },
    { identifier: ACTION_DONE, buttonTitle: t('tasks.complete'), options: { opensAppToForeground: true } },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: t('reminders.actionSnooze'),
      options: { opensAppToForeground: true },
    },
  ]).catch(() => undefined);
}

/** Lembrete adiado, guardado para sobreviver ao reagendamento de cada sincronização. */
export interface Snooze {
  identifier: string;
  at: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  category: string;
}

async function readSnoozes(): Promise<Snooze[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKeys.snoozes);
    return raw ? (JSON.parse(raw) as Snooze[]) : [];
  } catch {
    return [];
  }
}

async function writeSnoozes(list: Snooze[]): Promise<void> {
  await AsyncStorage.setItem(storageKeys.snoozes, JSON.stringify(list)).catch(() => undefined);
}

/** Adiamentos ainda válidos, sem repetir o mesmo lembrete (o mais recente vale). */
export function activeSnoozes(list: Snooze[], now: Date = new Date()): Snooze[] {
  const byOrigin = new Map<string, Snooze>();
  for (const s of list) {
    if (new Date(s.at).getTime() <= now.getTime()) continue;
    const origin = s.identifier.split(':adiado:')[0];
    const prev = byOrigin.get(origin);
    if (!prev || prev.at < s.at) byOrigin.set(origin, s);
  }
  return [...byOrigin.values()].sort((a, b) => a.at.localeCompare(b.at));
}

async function scheduleSnooze(s: Snooze): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: s.identifier,
    content: {
      title: s.title,
      body: s.body ?? undefined,
      data: s.data,
      color: marca.cores.claro.primary,
      categoryIdentifier: s.category,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(s.at),
      channelId: typeof s.data.channelId === 'string' ? s.data.channelId : CHANNEL_PRIVATE,
    },
  });
}

/** Adia um lembrete já mostrado: a mesma notificação volta em 10 minutos (uma vez só). */
export async function snoozeReminder(request: Notifications.NotificationRequest): Promise<void> {
  if (!notificationsSupported) return;
  const { content } = request;
  await Notifications.dismissNotificationAsync(request.identifier).catch(() => undefined);
  const origin = request.identifier.split(':adiado:')[0];
  const snooze: Snooze = {
    identifier: `${origin}:adiado:${Date.now()}`,
    at: new Date(Date.now() + SNOOZE_MINUTES * 60_000).toISOString(),
    title: content.title ?? t('reminders.lockedContent'),
    body: content.body ?? null,
    data: Object.fromEntries(Object.entries(content.data ?? {}).filter(([key]) => key !== 'synckPlan')),
    category: content.categoryIdentifier ?? REMINDER_CATEGORY,
  };
  const previous = await readSnoozes();
  for (const old of previous.filter((p) => p.identifier.startsWith(`${origin}:adiado:`))) {
    await Notifications.cancelScheduledNotificationAsync(old.identifier).catch(() => undefined);
  }
  const next = activeSnoozes([
    ...previous.filter((p) => !p.identifier.startsWith(`${origin}:adiado:`)),
    snooze,
  ]);
  await writeSnoozes(next);
  await scheduleSnooze(snooze);
}

/** Tarefa concluída pela notificação: some o adiamento pendente dela. */
export async function forgetSnoozesFor(prefix: string): Promise<void> {
  const list = await readSnoozes();
  const keep = list.filter((s) => !s.identifier.startsWith(prefix));
  for (const s of list.filter((x) => x.identifier.startsWith(prefix))) {
    await Notifications.cancelScheduledNotificationAsync(s.identifier).catch(() => undefined);
  }
  await writeSnoozes(keep);
}

export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await ensureCategory();
  // Luz de notificação na cor da marca (em aparelhos que têm LED).
  const base = { vibrationPattern: [0, 250, 150, 250], lightColor: marca.cores.claro.primary };
  // Canal com conteúdo oculto na tela bloqueada (padrão, mais privado).
  await Notifications.setNotificationChannelAsync(CHANNEL_PRIVATE, {
    ...base,
    name: t('reminders.channelName'),
    importance: AndroidImportance.HIGH,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_PUBLIC, {
    ...base,
    name: `${t('reminders.channelName')} (detalhes visíveis)`,
    importance: AndroidImportance.HIGH,
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_QUIET, {
    name: `${t('reminders.channelName')} (silencioso)`,
    importance: AndroidImportance.LOW,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
    enableVibrate: false,
    sound: null,
  });
}

export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (!notificationsSupported) return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status as 'granted' | 'denied' | 'undetermined';
}

export async function requestPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  await ensureChannels();
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

interface ReminderCandidate {
  at: Date;
  occ: Occurrence;
  minutes: number;
}

interface TaskAlertCandidate {
  at: Date;
  task: Task;
  minutes: number;
}

/** Calcula quais lembretes agendar (função pura, testável). */
export function planReminders(occurrences: Occurrence[], now: Date = new Date()): ReminderCandidate[] {
  const horizon = now.getTime() + HORIZON_DAYS * 86_400_000;
  const list: ReminderCandidate[] = [];
  for (const occ of occurrences) {
    if (['cancelled', 'completed', 'archived'].includes(occ.event.status) || occ.event.deleted_at) continue;
    for (const minutes of occ.event.my_reminders ?? []) {
      const at = new Date(occ.start.getTime() - minutes * 60_000);
      if (at.getTime() > now.getTime() && at.getTime() <= horizon) list.push({ at, occ, minutes });
    }
  }
  return list.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_SCHEDULED);
}

/** Avisos de tarefas e lembretes (só a próxima ocorrência de cada um). */
export function planTaskAlerts(tasks: Task[], now: Date = new Date()): TaskAlertCandidate[] {
  const horizon = now.getTime() + HORIZON_DAYS * 86_400_000;
  const list: TaskAlertCandidate[] = [];
  for (const task of tasks) {
    if (!isOpen(task) || !task.my_alerts?.length) continue;
    const base = alertBase(task);
    if (!base) continue;
    for (const minutes of task.my_alerts) {
      const at = new Date(base.getTime() - minutes * 60_000);
      if (at.getTime() > now.getTime() && at.getTime() <= horizon) list.push({ at, task, minutes });
    }
  }
  return list.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Junta eventos e tarefas respeitando o limite de agendamentos do aparelho. */
export function combinePlans(
  events: ReminderCandidate[],
  tasks: TaskAlertCandidate[],
  max = MAX_SCHEDULED,
): { events: ReminderCandidate[]; tasks: TaskAlertCandidate[] } {
  const all = [
    ...events.map((e) => ({ at: e.at.getTime(), e })),
    ...tasks.map((t) => ({ at: t.at.getTime(), t })),
  ]
    .sort((a, b) => a.at - b.at)
    .slice(0, Math.max(0, max));
  return {
    events: all.flatMap((x) => ('e' in x && x.e ? [x.e] : [])),
    tasks: all.flatMap((x) => ('t' in x && x.t ? [x.t] : [])),
  };
}

export async function rescheduleReminders(
  occurrences: Occurrence[],
  prefs: NotificationPreferences | null,
  timezone: string,
  timeFormat: TimeFormat,
  tasks: Task[] = [],
  keepSnooze: (s: Snooze) => boolean = () => true,
): Promise<number> {
  if (!notificationsSupported) return 0;
  try {
    if (
      (prefs && (!prefs.enabled || !prefs.notify_reminders)) ||
      (await getPermissionStatus()) !== 'granted'
    ) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return 0;
    }
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const existing = new Map(pending.map((r) => [r.identifier, r.content.data?.synckPlan]));
    const keep = new Set<string>();
    const schedule = async (request: Notifications.NotificationRequestInput & { identifier: string }) => {
      const signature = JSON.stringify([request.trigger, request.content]);
      keep.add(request.identifier);
      if (existing.get(request.identifier) === signature) return;
      await Notifications.scheduleNotificationAsync({
        ...request,
        content: { ...request.content, data: { ...request.content.data, synckPlan: signature } },
      });
    };
    await ensureChannels();

    const snoozes = activeSnoozes(await readSnoozes())
      .filter(keepSnooze)
      .slice(0, MAX_SCHEDULED);
    await writeSnoozes(snoozes);
    const normal = prefs?.show_details_on_lock_screen ? CHANNEL_PUBLIC : CHANNEL_PRIVATE;
    const mute = prefs?.sound === false,
      noVibration = prefs?.vibration === false;
    const normalChannel =
      mute || noVibration ? normal + (mute ? '-sem-som' : '') + (noVibration ? '-sem-vibracao' : '') : normal;
    if (Platform.OS === 'android' && normalChannel !== normal)
      await Notifications.setNotificationChannelAsync(normalChannel, {
        name:
          'Lembretes' +
          (mute ? ' sem som' : '') +
          (noVibration ? ' sem vibração' : '') +
          (normal === CHANNEL_PUBLIC ? ' (detalhes visíveis)' : ''),
        importance: AndroidImportance.HIGH,
        lockscreenVisibility:
          normal === CHANNEL_PUBLIC
            ? AndroidNotificationVisibility.PUBLIC
            : AndroidNotificationVisibility.PRIVATE,
        sound: mute ? null : 'default',
        enableVibrate: !noVibration,
      });
    const plan = combinePlans(
      planReminders(occurrences),
      planTaskAlerts(tasks),
      MAX_SCHEDULED - snoozes.length,
    );
    for (const s of snoozes) {
      keep.add(s.identifier);
      if (!existing.has(s.identifier)) await scheduleSnooze(s);
    }
    const today = todayKey(timezone);
    for (const { at, task, minutes } of plan.tasks) {
      const quiet = isWithinQuietHours(
        at,
        timezone,
        prefs?.quiet_hours_start ?? null,
        prefs?.quiet_hours_end ?? null,
      );
      const channelId = quiet ? CHANNEL_QUIET : normalChannel;
      await schedule({
        identifier: `task:${task.id}:${task.due_date}:${minutes}`,
        content: {
          title: task.due_time ? reminderTitle(task.title, minutes) : task.title,
          body: describeDue(task, today, timeFormat) ?? undefined,
          data: { taskId: task.id, occurrence: task.due_date, silent: quiet || mute, channelId },
          sound: !quiet && prefs?.sound !== false ? 'default' : false,
          color: marca.cores.claro.primary,
          categoryIdentifier: TASK_CATEGORY,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId },
      });
    }
    for (const { at, occ, minutes } of plan.events) {
      const quiet = isWithinQuietHours(
        at,
        timezone,
        prefs?.quiet_hours_start ?? null,
        prefs?.quiet_hours_end ?? null,
      );
      const channelId = quiet ? CHANNEL_QUIET : normalChannel;
      const title = occ.event.is_masked
        ? t('reminders.lockedContent')
        : reminderTitle(occ.title ?? t('reminders.lockedContent'), minutes);
      const when = formatOccurrenceTime(occ, timezone, timeFormat);
      await schedule({
        identifier: `rem:${occ.key}:${minutes}`,
        content: {
          title,
          body: [when, occ.location].filter(Boolean).join(' · '),
          data: {
            eventId: occ.event.id,
            originalDate: occ.originalDate,
            startsAt: occ.start.toISOString(),
            silent: quiet || mute,
            channelId,
          },
          sound: !quiet && prefs?.sound !== false ? 'default' : false,
          color: marca.cores.claro.primary,
          categoryIdentifier: REMINDER_CATEGORY,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId },
      });
    }
    for (const id of existing.keys())
      if ((id.startsWith('rem:') || id.startsWith('task:')) && !keep.has(id))
        await Notifications.cancelScheduledNotificationAsync(id);
    return plan.events.length + plan.tasks.length + snoozes.length;
  } catch (error) {
    await logError('lembretes', error);
    return 0;
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (!notificationsSupported) return;
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  await AsyncStorage.removeItem(storageKeys.snoozes).catch(() => undefined);
}
