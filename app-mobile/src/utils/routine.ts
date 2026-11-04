import type { DateKey, RoutinePeriod, Occurrence, CalendarEvent } from '@/models/types';
import { addDaysToKey, isValidTimezone, localToInstant, isValidDateKey, toDateKey } from './dates';
import { mergeIntervals, type Interval } from './freeTime';

export const ROUTINE_KINDS = {
  work: 'Trabalho',
  school: 'Escola / faculdade',
  sleep: 'Sono',
  commute: 'Deslocamento',
  meal: 'Refeição',
  exercise: 'Atividade física',
  care: 'Cuidados pessoais',
  custom: 'Outro período',
} as const;
export type { RoutinePeriod } from '@/models/types';
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export function validRoutine(period: RoutinePeriod): boolean {
  return (
    !!period.id &&
    !!period.title.trim() &&
    period.title.trim().length <= 60 &&
    period.kind in ROUTINE_KINDS &&
    period.days.length > 0 &&
    period.days.length <= 7 &&
    period.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    new Set(period.days).size === period.days.length &&
    TIME.test(period.start) &&
    TIME.test(period.end) &&
    period.start !== period.end &&
    isValidTimezone(period.timezone)
  );
}

export interface RoutineBlock extends Interval {
  period: RoutinePeriod;
  date: DateKey;
  changed: boolean;
}

export function validRoutineException(e: NonNullable<RoutinePeriod['exceptions']>[number]): boolean {
  if (!isValidDateKey(e.original_date)) return false;
  if (e.action === 'skip') return !e.starts_at && !e.ends_at;
  const start = Date.parse(e.starts_at ?? ''),
    end = Date.parse(e.ends_at ?? '');
  return e.action === 'move' && Number.isFinite(start) && end > start && end - start <= 172800000;
}

/** Exceções usam a data original no fuso da rotina, inclusive em viagens e turnos noturnos. */
export function routineBlocks(periods: RoutinePeriod[], days: DateKey[]): RoutineBlock[] {
  const dates = new Set(days.flatMap((d) => [addDaysToKey(d, -1), d, addDaysToKey(d, 1)]));
  const result: RoutineBlock[] = [];
  for (const period of periods) {
    if (!period.enabled || !validRoutine(period)) continue;
    const exceptions = new Map(
      (period.exceptions ?? []).filter(validRoutineException).map((e) => [e.original_date, e]),
    );
    for (const day of dates) {
      if (!period.days.includes(new Date(day + 'T12:00:00Z').getUTCDay()) || exceptions.has(day)) continue;
      result.push({
        period,
        date: day,
        changed: false,
        start: localToInstant(day, period.start, period.timezone).getTime(),
        end: localToInstant(
          period.end < period.start ? addDaysToKey(day, 1) : day,
          period.end,
          period.timezone,
        ).getTime(),
      });
    }
    // Uma ocorrência pode ter sido movida de outra semana para a janela atual.
    for (const e of exceptions.values())
      if (e.action === 'move') {
        const start = Date.parse(e.starts_at!),
          end = Date.parse(e.ends_at!);
        if (
          [...dates].some(
            (d) =>
              d >= addDaysToKey(toDateKey(new Date(start), period.timezone), -1) &&
              d <= addDaysToKey(toDateKey(new Date(end), period.timezone), 1),
          )
        )
          result.push({ period, date: e.original_date, start, end, changed: true });
      }
  }
  return result.sort((a, b) => a.start - b.start);
}

export function routineBusy(periods: RoutinePeriod[], days: DateKey[]): Interval[] {
  return mergeIntervals(routineBlocks(periods, days).map(({ start, end }) => ({ start, end })));
}

export function routineConflicts(periods: RoutinePeriod[], start: number, end: number): RoutineBlock[] {
  if (!Number.isFinite(start) || end <= start) return [];
  const days: string[] = [];
  for (
    let d = addDaysToKey(toDateKey(new Date(start), 'UTC'), -1), n = 0;
    d <= addDaysToKey(toDateKey(new Date(end), 'UTC'), 1) && n < 370;
    d = addDaysToKey(d, 1), n++
  )
    days.push(d);
  return routineBlocks(periods, days).filter((b) => b.start < end && b.end > start);
}

export function routineOccurrences(periods: RoutinePeriod[], from: Date, to: Date): Occurrence[] {
  const days: string[] = [];
  for (
    let d = toDateKey(from, 'UTC'), n = 0;
    d <= toDateKey(to, 'UTC') && n < 370;
    d = addDaysToKey(d, 1), n++
  )
    days.push(d);
  return routineBlocks(periods, days)
    .filter((b) => b.start < +to && b.end > +from)
    .map((b) => {
      const title = b.period.title + ' · Rotina';
      const event = {
        id: 'routine:' + b.period.id,
        calendar_id: '__routine',
        title,
        description: null,
        location: null,
        address: null,
        url: null,
        all_day: false,
        starts_at: new Date(b.start).toISOString(),
        ends_at: new Date(b.end).toISOString(),
        start_date: null,
        end_date: null,
        timezone: b.period.timezone,
        recurrence_rule: null,
        assignee_id: null,
        color: '#718878',
        event_type: 'custom',
        status: 'planned',
        privacy: 'private',
        created_by: null,
        version: 0,
        created_at: '',
        updated_at: '',
        updated_by: null,
        completed_at: null,
        is_masked: false,
        exceptions: [],
        attendee_ids: [],
        my_reminders: [],
        deleted_at: null,
      } as CalendarEvent;
      return {
        event,
        key: event.id + ':' + b.date,
        routine: { periodId: b.period.id, date: b.date },
        originalDate: b.date,
        start: new Date(b.start),
        end: new Date(b.end),
        allDay: false,
        startDate: null,
        endDate: null,
        title,
        description: null,
        location: null,
        isRecurring: true,
        isException: b.changed,
      };
    });
}
