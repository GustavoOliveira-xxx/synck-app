// Cópia gerada de app-mobile/src/utils/recurrence.ts por scripts/copiar-logica-push.mjs. Não edite aqui.
// Recorrência (eventos que se repetem).
//
// A regra é guardada no padrão RRULE (RFC 5545), num subconjunto simples:
//   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY ; INTERVAL=n ; BYDAY=MO,WE ;
//   BYMONTHDAY=n ; UNTIL=AAAAMMDD (inclusivo) ; COUNT=n
//
// As ocorrências NÃO são gravadas no banco: são calculadas aqui, apenas para
// o período que aparece na tela (ocorrências virtuais). Exceções ("só esta
// ocorrência") vêm do servidor e são aplicadas por cima.
import { DateTime } from 'npm:luxon@3.7.2';

import { interpolate, strings } from '../i18n/index.ts';
import type { CalendarEvent, DateKey, Occurrence, RecurrenceException } from '../models/types.ts';

import {
  addDaysToKey,
  compareKeys,
  dateKeyParts,
  diffDays,
  formatDateKey,
  makeDateKey,
  safeTimezone,
  startOfDayInstant,
  toDateKey,
  weekdayOfKey,
} from './dates.ts';

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** Códigos dos dias da semana, na mesma ordem de weekdayOfKey (0 = domingo). */
export const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

export interface RecurrenceRule {
  freq: Frequency;
  interval: number;
  byDay: WeekdayCode[];
  byMonthDay: number | null;
  /** Último dia possível (inclusivo), em data local do evento. */
  until: DateKey | null;
  count: number | null;
}

export type RecurrencePreset = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';

const MAX_ITERATIONS = 5000;

// ---------------------------------------------------------------------
// Leitura e escrita da regra
// ---------------------------------------------------------------------

export function parseRule(text: string | null | undefined): RecurrenceRule | null {
  if (!text) return null;
  const rule: RecurrenceRule = {
    freq: 'DAILY',
    interval: 1,
    byDay: [],
    byMonthDay: null,
    until: null,
    count: null,
  };
  let hasFreq = false;
  for (const part of text.split(';')) {
    const [name, value] = part.split('=');
    if (!value) return null;
    switch (name) {
      case 'FREQ':
        if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(value)) return null;
        rule.freq = value as Frequency;
        hasFreq = true;
        break;
      case 'INTERVAL':
        rule.interval = Number(value);
        if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 99) return null;
        break;
      case 'BYDAY': {
        const days = value.split(',');
        if (!days.every((d) => (WEEKDAY_CODES as readonly string[]).includes(d))) return null;
        rule.byDay = days as WeekdayCode[];
        break;
      }
      case 'BYMONTHDAY':
        rule.byMonthDay = Number(value);
        if (!Number.isInteger(rule.byMonthDay) || rule.byMonthDay < 1 || rule.byMonthDay > 31) return null;
        break;
      case 'UNTIL': {
        const m = /^(\d{4})(\d{2})(\d{2})/.exec(value);
        if (!m) return null;
        rule.until = `${m[1]}-${m[2]}-${m[3]}`;
        break;
      }
      case 'COUNT':
        rule.count = Number(value);
        if (!Number.isInteger(rule.count) || rule.count < 1 || rule.count > 999) return null;
        break;
      default:
        return null;
    }
  }
  if (!hasFreq || (rule.until && rule.count)) return null;
  return rule;
}

export function serializeRule(rule: RecurrenceRule): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.freq === 'WEEKLY' && rule.byDay.length > 0) {
    const ordered = [...new Set(rule.byDay)].sort((a, b) => mondayIndex(a) - mondayIndex(b));
    parts.push(`BYDAY=${ordered.join(',')}`);
  }
  if (rule.freq === 'MONTHLY' && rule.byMonthDay) parts.push(`BYMONTHDAY=${rule.byMonthDay}`);
  if (rule.until) parts.push(`UNTIL=${rule.until.replace(/-/g, '')}`);
  else if (rule.count) parts.push(`COUNT=${rule.count}`);
  return parts.join(';');
}

/** Posição do dia numa semana que começa na segunda (padrão da RFC 5545). */
function mondayIndex(code: WeekdayCode): number {
  return (WEEKDAY_CODES.indexOf(code) + 6) % 7;
}

export function presetToRule(preset: RecurrencePreset, startKey: DateKey): RecurrenceRule | null {
  const base = { byDay: [] as WeekdayCode[], byMonthDay: null, until: null, count: null };
  switch (preset) {
    case 'daily':
      return { ...base, freq: 'DAILY', interval: 1 };
    case 'weekly':
      return { ...base, freq: 'WEEKLY', interval: 1, byDay: [WEEKDAY_CODES[weekdayOfKey(startKey)]] };
    case 'biweekly':
      return { ...base, freq: 'WEEKLY', interval: 2, byDay: [WEEKDAY_CODES[weekdayOfKey(startKey)]] };
    case 'monthly':
      return { ...base, freq: 'MONTHLY', interval: 1 };
    case 'yearly':
      return { ...base, freq: 'YEARLY', interval: 1 };
    default:
      return null;
  }
}

export function ruleToPreset(rule: RecurrenceRule | null, startKey: DateKey): RecurrencePreset {
  if (!rule) return 'none';
  if (rule.until || rule.count || rule.byMonthDay) return 'custom';
  const startDay = WEEKDAY_CODES[weekdayOfKey(startKey)];
  const onlyStartDay = rule.byDay.length === 0 || (rule.byDay.length === 1 && rule.byDay[0] === startDay);
  if (rule.freq === 'DAILY' && rule.interval === 1) return 'daily';
  if (rule.freq === 'WEEKLY' && rule.interval === 1 && onlyStartDay) return 'weekly';
  if (rule.freq === 'WEEKLY' && rule.interval === 2 && onlyStartDay) return 'biweekly';
  if (rule.freq === 'MONTHLY' && rule.interval === 1) return 'monthly';
  if (rule.freq === 'YEARLY' && rule.interval === 1) return 'yearly';
  return 'custom';
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** Descrição em português, ex.: "Toda semana às segundas e quartas, até 31/12/2026". */
export function describeRule(rule: RecurrenceRule, startKey: DateKey): string {
  const r = strings.recurrence;
  const n = rule.interval;
  let text: string;
  switch (rule.freq) {
    case 'DAILY':
      text = n === 1 ? r.daily : interpolate(r.everyNDays, { n });
      break;
    case 'WEEKLY':
      text = n === 1 ? r.weekly : interpolate(r.everyNWeeks, { n });
      break;
    case 'MONTHLY':
      text = n === 1 ? r.monthly : interpolate(r.everyNMonths, { n });
      break;
    default:
      text = n === 1 ? r.yearly : interpolate(r.everyNYears, { n });
  }
  const { day, month } = dateKeyParts(startKey);
  if (rule.freq === 'WEEKLY') {
    const days = (rule.byDay.length ? rule.byDay : [WEEKDAY_CODES[weekdayOfKey(startKey)]])
      .slice()
      .sort((a, b) => mondayIndex(a) - mondayIndex(b))
      .map((code) => strings.weekdays.plural[WEEKDAY_CODES.indexOf(code)]);
    text += ` ${interpolate(r.onWeekdays, { days: joinList(days) })}`;
  } else if (rule.freq === 'MONTHLY') {
    text += ` ${interpolate(r.onMonthDay, { day: rule.byMonthDay ?? day })}`;
  } else if (rule.freq === 'YEARLY') {
    text += ` ${interpolate(r.onYearDay, { day, month: strings.months.long[month - 1] })}`;
  }
  if (rule.until) text += `, ${interpolate(r.until, { date: formatDateKey(rule.until) })}`;
  else if (rule.count) text += `, ${rule.count === 1 ? r.once : interpolate(r.times, { n: rule.count })}`;
  return text;
}

// ---------------------------------------------------------------------
// Geração das datas da série
// ---------------------------------------------------------------------

function daysInMonth(year: number, month: number): number {
  return DateTime.utc(year, month, 1).daysInMonth ?? 31;
}

/**
 * Gera, em ordem, as datas locais da série a partir do início.
 * "fromKey" permite pular direto para perto de um período distante, mas só
 * quando não há COUNT (com COUNT é preciso contar desde o começo).
 */
export function* seriesDates(rule: RecurrenceRule, startKey: DateKey, fromKey?: DateKey): Generator<DateKey> {
  const canSkip = !rule.count && fromKey && compareKeys(fromKey, startKey) > 0;
  const gap = canSkip ? diffDays(fromKey!, startKey) : 0;
  const { year: sy, month: sm, day: sd } = dateKeyParts(startKey);

  if (rule.freq === 'DAILY') {
    let k = Math.max(0, Math.floor(gap / rule.interval) - 1);
    for (;;) yield addDaysToKey(startKey, k++ * rule.interval);
  }

  if (rule.freq === 'WEEKLY') {
    const codes = rule.byDay.length ? rule.byDay : [WEEKDAY_CODES[weekdayOfKey(startKey)]];
    const offsets = [...new Set(codes.map(mondayIndex))].sort((a, b) => a - b);
    const weekStart = addDaysToKey(startKey, -((weekdayOfKey(startKey) + 6) % 7));
    let w = Math.max(0, Math.floor(gap / 7 / rule.interval) - 1);
    for (;;) {
      const ws = addDaysToKey(weekStart, w++ * rule.interval * 7);
      for (const offset of offsets) {
        const date = addDaysToKey(ws, offset);
        if (compareKeys(date, startKey) >= 0) yield date;
      }
    }
  }

  if (rule.freq === 'MONTHLY') {
    const day = rule.byMonthDay ?? sd;
    let m = Math.max(0, Math.floor(gap / 31 / rule.interval) - 1);
    for (;;) {
      const total = sm - 1 + m++ * rule.interval;
      const year = sy + Math.floor(total / 12);
      const month = (total % 12) + 1;
      // RFC 5545: meses sem o dia (ex.: 31) são pulados.
      if (day <= daysInMonth(year, month)) {
        const date = makeDateKey(year, month, day);
        if (compareKeys(date, startKey) >= 0) yield date;
      }
    }
  }

  // YEARLY: mesmo dia e mês; 29/02 só em anos bissextos.
  let y = Math.max(0, Math.floor(gap / 366 / rule.interval) - 1);
  for (;;) {
    const year = sy + y++ * rule.interval;
    if (sd <= daysInMonth(year, sm)) yield makeDateKey(year, sm, sd);
  }
}

/** Quantas ocorrências da série acontecem antes de uma data (para dividir séries com COUNT). */
export function countOccurrencesBefore(rule: RecurrenceRule, startKey: DateKey, beforeKey: DateKey): number {
  let count = 0;
  for (const date of seriesDates(rule, startKey)) {
    if (compareKeys(date, beforeKey) >= 0 || count >= MAX_ITERATIONS) break;
    if (rule.until && compareKeys(date, rule.until) > 0) break;
    if (rule.count && count >= rule.count) break;
    count += 1;
  }
  return count;
}

export function firstOccurrenceDate(rule: RecurrenceRule, startKey: DateKey): DateKey | null {
  const first = seriesDates(rule, startKey).next().value as DateKey | undefined;
  if (!first || (rule.until && compareKeys(first, rule.until) > 0)) return null;
  return first;
}

// ---------------------------------------------------------------------
// Expansão de eventos em ocorrências
// ---------------------------------------------------------------------

type ExpandableEvent = Pick<
  CalendarEvent,
  | 'id'
  | 'starts_at'
  | 'ends_at'
  | 'all_day'
  | 'start_date'
  | 'end_date'
  | 'timezone'
  | 'recurrence_rule'
  | 'exceptions'
  | 'title'
  | 'description'
  | 'location'
>;

function overlaps(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return start < rangeEnd && end > rangeStart;
}

function buildOccurrence(
  event: ExpandableEvent,
  originalDate: DateKey,
  start: Date,
  end: Date,
  startDate: DateKey | null,
  endDate: DateKey | null,
  isRecurring: boolean,
  exception?: RecurrenceException,
): Occurrence {
  return {
    key: `${event.id}:${originalDate}`,
    event: exception?.status
      ? ({ ...event, status: exception.status, completed_at: null } as CalendarEvent)
      : (event as CalendarEvent),
    originalDate,
    start: exception?.starts_at ? new Date(exception.starts_at) : start,
    end: exception?.ends_at ? new Date(exception.ends_at) : end,
    allDay: event.all_day && !exception?.starts_at,
    startDate: exception?.starts_at ? null : startDate,
    endDate: exception?.starts_at ? null : endDate,
    title: exception?.title ?? event.title,
    description: exception?.description ?? event.description,
    location: exception?.location ?? event.location,
    isRecurring,
    isException: !!exception,
  };
}

/**
 * Ocorrências de um evento que tocam o período [rangeStart, rangeEnd).
 * Para eventos que não se repetem, devolve no máximo uma ocorrência.
 */
export function expandEvent(event: ExpandableEvent, rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const tz = safeTimezone(event.timezone);
  const startsAt = new Date(event.starts_at);
  const endsAt = new Date(event.ends_at);
  const rule = parseRule(event.recurrence_rule);

  if (!rule) {
    const originalDate = event.all_day && event.start_date ? event.start_date : toDateKey(startsAt, tz);
    const occ = buildOccurrence(
      event,
      originalDate,
      startsAt,
      endsAt,
      event.start_date,
      event.end_date,
      false,
    );
    return overlaps(occ.start, occ.end, rangeStart, rangeEnd) ? [occ] : [];
  }

  const exceptions = new Map((event.exceptions ?? []).map((x) => [x.original_date, x]));
  const durationMs = Math.max(0, endsAt.getTime() - startsAt.getTime());
  const base = DateTime.fromJSDate(startsAt).setZone(tz);
  const baseKey = event.all_day && event.start_date ? event.start_date : (base.toISODate() as DateKey);
  const lengthDays =
    event.all_day && event.start_date && event.end_date ? diffDays(event.end_date, event.start_date) : 0;

  // Margem de 7 dias para pegar ocorrências movidas por exceção e eventos longos.
  const marginMs = 7 * 86_400_000;
  const fromKey = toDateKey(new Date(rangeStart.getTime() - durationMs - marginMs), tz);
  const stopAt = rangeEnd.getTime() + marginMs;

  const result: Occurrence[] = [];
  let produced = 0;
  let iterations = 0;
  for (const date of seriesDates(rule, baseKey, fromKey)) {
    if (++iterations > MAX_ITERATIONS) break;
    if (rule.until && compareKeys(date, rule.until) > 0) break;
    if (rule.count && produced >= rule.count) break;
    produced += 1;

    let start: Date;
    let end: Date;
    let startDate: DateKey | null = null;
    let endDate: DateKey | null = null;
    if (event.all_day) {
      startDate = date;
      endDate = addDaysToKey(date, lengthDays);
      start = startOfDayInstant(startDate, tz);
      end = startOfDayInstant(addDaysToKey(endDate, 1), tz);
    } else {
      const { year, month, day } = dateKeyParts(date);
      // Mesmo horário de parede no fuso do evento (respeita horário de verão).
      start = DateTime.fromObject(
        { year, month, day, hour: base.hour, minute: base.minute, second: base.second },
        { zone: tz },
      ).toJSDate();
      end = new Date(start.getTime() + durationMs);
    }
    if (start.getTime() > stopAt) break;

    const exception = exceptions.get(date);
    if (exception?.is_cancelled) continue;
    const occ = buildOccurrence(event, date, start, end, startDate, endDate, true, exception);
    if (overlaps(occ.start, occ.end, rangeStart, rangeEnd)) result.push(occ);
  }
  return result;
}

export function sortOccurrences(list: Occurrence[]): Occurrence[] {
  return list.sort(
    (a, b) =>
      Number(b.allDay) - Number(a.allDay) ||
      a.start.getTime() - b.start.getTime() ||
      (a.title ?? '').localeCompare(b.title ?? ''),
  );
}

export function expandEvents(events: ExpandableEvent[], rangeStart: Date, rangeEnd: Date): Occurrence[] {
  return sortOccurrences(events.flatMap((e) => expandEvent(e, rangeStart, rangeEnd)));
}

// ---------------------------------------------------------------------
// Edição de séries
// ---------------------------------------------------------------------

/** Regra da série original encerrada no dia anterior a uma ocorrência. */
export function ruleEndingBefore(rule: RecurrenceRule, occurrenceDate: DateKey): RecurrenceRule {
  return { ...rule, count: null, until: addDaysToKey(occurrenceDate, -1) };
}

/** Regra da nova série ("esta e as próximas"), preservando o total quando há COUNT. */
export function ruleForFollowing(
  rule: RecurrenceRule,
  startKey: DateKey,
  occurrenceDate: DateKey,
): RecurrenceRule {
  if (!rule.count) return { ...rule };
  const before = countOccurrencesBefore(rule, startKey, occurrenceDate);
  return { ...rule, count: Math.max(1, rule.count - before) };
}

export function isFirstOccurrence(rule: RecurrenceRule, startKey: DateKey, occurrenceDate: DateKey): boolean {
  return firstOccurrenceDate(rule, startKey) === occurrenceDate;
}
