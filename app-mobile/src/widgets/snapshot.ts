// Retrato compacto da agenda para os widgets da tela inicial do Android.
// O app grava este retrato sempre que os dados mudam; os widgets o leem
// mesmo com o app fechado (a cada 30 minutos o sistema pede para redesenhar),
// por isso aqui só vão datas absolutas e o "hoje" é calculado na hora de
// desenhar. Só entram título, horário e cor: nada de descrição, local ou
// pessoas (o que aparece na tela inicial fica à vista de quem pega o celular).
import { t } from '@/i18n';
import type { DateKey, Occurrence, Task } from '@/models/types';
import { addDaysToKey, instantToLocal, spannedDayKeys, toDateKey } from '@/utils/dates';
import { isOpen } from '@/utils/tasks';

export const WIDGET_SNAPSHOT_KEY = 'synck:widget:snapshot:v1';
export const WIDGET_COUNTDOWN_KEY = 'synck:widget:countdown:v1';

/** Nomes dos widgets (os mesmos de app.json, plugin react-native-android-widget). */
export const WIDGETS = ['SynckHoje', 'SynckCalendario', 'SynckContagem'] as const;
export type WidgetName = (typeof WIDGETS)[number];

export interface WidgetItem {
  kind: 'event' | 'task' | 'reminder';
  id: string;
  /** Data local (AAAA-MM-DD). */
  date: DateKey;
  title: string;
  /** "HH:MM" local, ou null para dia inteiro / tarefa sem horário. */
  time: string | null;
  endTime: string | null;
  color: string;
  /** Data original da ocorrência (para abrir a certa no app). */
  occurrence?: string;
}

export interface WidgetCountdown {
  eventId: string;
  title: string;
  /** Dia local do evento (AAAA-MM-DD) e horário, se houver. */
  date: DateKey;
  time: string | null;
  color: string;
  occurrence: string;
}

export interface WidgetSnapshot {
  v: 1;
  updatedAt: string;
  weekStartsOn: 0 | 1;
  /** Dias com algo marcado (pontinhos do mini calendário). */
  busyDays: DateKey[];
  /** Itens de ontem até os próximos 14 dias (o widget escolhe os de hoje). */
  items: WidgetItem[];
}

export const EMPTY_SNAPSHOT: WidgetSnapshot = {
  v: 1,
  updatedAt: new Date(0).toISOString(),
  weekStartsOn: 0,
  busyDays: [],
  items: [],
};

const hhmm = (date: Date, timezone: string) => instantToLocal(date, timezone).time.slice(0, 5);

export function buildSnapshot({
  occurrences,
  tasks,
  calendarColors,
  timezone,
  weekStartsOn,
  today,
  fallbackColor,
}: {
  occurrences: Occurrence[];
  tasks: Task[];
  calendarColors: Record<string, string | undefined>;
  timezone: string;
  weekStartsOn: 0 | 1;
  today: DateKey;
  fallbackColor: string;
}): WidgetSnapshot {
  const first = addDaysToKey(today, -1);
  const last = addDaysToKey(today, 14);
  const busy = new Set<DateKey>();
  const items: WidgetItem[] = [];
  for (const occ of occurrences) {
    if (occ.event.status === 'cancelled') continue;
    const days = spannedDayKeys(occ, timezone);
    days.forEach((d) => busy.add(d));
    for (const day of days) {
      if (day < first || day > last) continue;
      const startsToday = !occ.allDay && toDateKey(occ.start, timezone) === day;
      items.push({
        kind: 'event',
        id: occ.event.id,
        date: day,
        title: occ.event.is_masked ? t('common.busy') : (occ.title ?? ''),
        time: occ.allDay || !startsToday ? null : hhmm(occ.start, timezone),
        endTime: occ.allDay || !startsToday ? null : hhmm(occ.end, timezone),
        color: occ.event.color ?? calendarColors[occ.event.calendar_id] ?? fallbackColor,
        occurrence: occ.originalDate,
      });
    }
  }
  for (const task of tasks) {
    if (!task.due_date || !isOpen(task)) continue;
    busy.add(task.due_date);
    if (task.due_date < first || task.due_date > last) continue;
    items.push({
      kind: task.item_type === 'reminder' ? 'reminder' : 'task',
      id: task.id,
      date: task.due_date,
      title: task.title,
      time: task.due_time ? task.due_time.slice(0, 5) : null,
      endTime: null,
      color: (task.calendar_id && calendarColors[task.calendar_id]) || fallbackColor,
    });
  }
  items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(a.time !== null) - Number(b.time !== null) ||
      (a.time ?? '').localeCompare(b.time ?? ''),
  );
  return {
    v: 1,
    updatedAt: new Date().toISOString(),
    weekStartsOn,
    busyDays: [...busy].sort(),
    items,
  };
}

/** Itens de um dia: os de dia inteiro primeiro, depois por horário. */
export function itemsOn(snapshot: WidgetSnapshot, day: DateKey): WidgetItem[] {
  return snapshot.items.filter((i) => i.date === day);
}

/** Dias inteiros entre hoje e a data (0 = hoje, negativo = já passou). */
export function daysUntil(today: DateKey, date: DateKey): number {
  return Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

/** Data local de hoje sem depender do fuso guardado (o widget usa o do aparelho). */
export function localToday(now: Date = new Date()): DateKey {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
