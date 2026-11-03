import type { DateKey, RoutinePeriod } from '@/models/types';
import { addDaysToKey, isValidTimezone, localToInstant } from './dates';
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

/** Inclui a véspera: o sono de segunda 23h–7h também ocupa terça de manhã. */
export function routineBusy(periods: RoutinePeriod[], days: DateKey[]): Interval[] {
  const dates = new Set(days.flatMap((d) => [addDaysToKey(d, -1), d, addDaysToKey(d, 1)]));
  const result: Interval[] = [];
  for (const period of periods) {
    if (!period.enabled || !validRoutine(period)) continue;
    for (const day of dates) {
      if (!period.days.includes(new Date(`${day}T12:00:00Z`).getUTCDay())) continue;
      result.push({
        start: localToInstant(day, period.start, period.timezone).getTime(),
        end: localToInstant(
          period.end < period.start ? addDaysToKey(day, 1) : day,
          period.end,
          period.timezone,
        ).getTime(),
      });
    }
  }
  return mergeIntervals(result);
}
