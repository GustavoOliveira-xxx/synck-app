// Horários ocupados e livres (tela Hoje, planejador, encontrar horário).
import type { DateKey, Occurrence } from '@/models/types';

import { addDaysToKey, localToInstant } from './dates';

/** Intervalo em milissegundos [start, end). */
export interface Interval {
  start: number;
  end: number;
}

export interface FreeSlot {
  day: DateKey;
  start: Date;
  end: Date;
  minutes: number;
}

/** Junta intervalos que se sobrepõem ou encostam. */
export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** Ocupação a partir das ocorrências (dia inteiro e cancelados não ocupam horário). */
export function busyFromOccurrences(occurrences: Occurrence[]): Interval[] {
  return mergeIntervals(
    occurrences
      .filter((o) => !o.allDay && o.event.status !== 'cancelled')
      .map((o) => ({ start: o.start.getTime(), end: o.end.getTime() })),
  );
}

/** Tira de `range` tudo o que estiver ocupado. */
export function subtract(range: Interval, busy: Interval[]): Interval[] {
  let pieces: Interval[] = [range];
  for (const b of busy) {
    const next: Interval[] = [];
    for (const p of pieces) {
      if (b.end <= p.start || b.start >= p.end) {
        next.push(p);
        continue;
      }
      if (b.start > p.start) next.push({ start: p.start, end: b.start });
      if (b.end < p.end) next.push({ start: b.end, end: p.end });
    }
    pieces = next;
  }
  return pieces;
}

/**
 * Horários livres de cada dia, dentro da janela do dia da pessoa (ex.: 8h às
 * 22h), sem o que já passou, com pelo menos `minMinutes`.
 */
export function freeSlots(
  busy: Interval[],
  days: DateKey[],
  timezone: string,
  dayStart: string,
  dayEnd: string,
  options: { minMinutes?: number; now?: Date } = {},
): FreeSlot[] {
  const min = (options.minMinutes ?? 30) * 60_000;
  // O que sobra de hoje começa no próximo quarto de hora (13:26 vira 13:30).
  const QUARTER = 15 * 60_000;
  const now = options.now ? Math.ceil(options.now.getTime() / QUARTER) * QUARTER : 0;
  const merged = mergeIntervals(busy);
  const out: FreeSlot[] = [];
  for (const day of days) {
    const start = localToInstant(day, dayStart.slice(0, 5), timezone).getTime();
    const endTime = dayEnd.slice(0, 5);
    const end =
      endTime === '00:00' || endTime === '24:00'
        ? localToInstant(addDaysToKey(day, 1), '00:00', timezone).getTime()
        : localToInstant(day, endTime, timezone).getTime();
    const window = { start: Math.max(start, now), end };
    if (window.end - window.start < min) continue;
    for (const piece of subtract(window, merged)) {
      if (piece.end - piece.start >= min) {
        out.push({
          day,
          start: new Date(piece.start),
          end: new Date(piece.end),
          minutes: Math.round((piece.end - piece.start) / 60_000),
        });
      }
    }
  }
  return out;
}

export function totalMinutes(slots: { minutes: number }[]): number {
  return slots.reduce((sum, s) => sum + s.minutes, 0);
}

/** Intervalos em que todos estão livres (encontrar horário em comum). */
export function commonFree(
  busyByPerson: Interval[][],
  days: DateKey[],
  timezone: string,
  dayStart: string,
  dayEnd: string,
  durationMinutes: number,
  now?: Date,
): FreeSlot[] {
  const all = mergeIntervals(busyByPerson.flat());
  return freeSlots(all, days, timezone, dayStart, dayEnd, { minMinutes: durationMinutes, now });
}

/** Opções de início dentro dos horários livres (de 30 em 30 minutos). */
export function startOptions(
  slots: FreeSlot[],
  durationMinutes: number,
  stepMinutes = 30,
  max = 20,
): Interval[] {
  const step = stepMinutes * 60_000;
  const length = durationMinutes * 60_000;
  const out: Interval[] = [];
  for (const slot of slots) {
    // Começa no próximo múltiplo do passo (ex.: 14:00, 14:30).
    let t = Math.ceil(slot.start.getTime() / step) * step;
    while (t + length <= slot.end.getTime() && out.length < max) {
      out.push({ start: t, end: t + length });
      t += step;
    }
    if (out.length >= max) break;
  }
  return out;
}
