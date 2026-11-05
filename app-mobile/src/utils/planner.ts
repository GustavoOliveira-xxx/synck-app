// "Planejar minha semana": sugere blocos de tempo para tarefas com prazo,
// usando só regras fixas (sem IA). Nada é gravado aqui; a pessoa revisa e
// confirma, e os blocos viram eventos ligados à tarefa (podem ser desfeitos).
//
// Regras:
//  * usa apenas horários livres dentro da janela do dia da pessoa;
//  * nunca mexe em compromissos existentes nem cria sobreposição;
//  * prazo mais próximo primeiro; depois maior prioridade; depois maior duração;
//  * tarefas longas (mais de 90 min) são divididas em blocos de até 60 min;
//  * sem duração estimada, considera 30 minutos;
//  * desconta o tempo já reservado em blocos futuros da mesma tarefa;
//  * o bloco inteiro precisa caber entre início e prazo, no fuso da tarefa.
import type { DateKey, Task } from '@/models/types';

import { compareKeys, addDaysToKey, startOfDayInstant } from './dates';
import type { FreeSlot } from './freeTime';
import { dueInstant, isOpen } from './tasks';

export const DEFAULT_TASK_MINUTES = 30;
const MAX_BLOCK = 60;
const MIN_BLOCK = 15;

export interface PlanReason {
  key: 'deadline' | 'priority' | 'free' | 'split' | 'overdue';
  value?: string | number;
}

export interface BlockSuggestion {
  id: string;
  task: Task;
  start: Date;
  end: Date;
  part: number;
  parts: number;
  reasons: PlanReason[];
}

export interface PlanResult {
  suggestions: BlockSuggestion[];
  unplaced: Task[];
  /** Tarefas sem duração estimada (considerei 30 minutos). */
  assumedDuration: string[];
}

export function chunks(minutes: number): number[] {
  if (minutes <= 90) return [minutes];
  const out: number[] = [];
  let left = minutes;
  while (left > 0) {
    const size =
      left > MAX_BLOCK && left - MAX_BLOCK < MIN_BLOCK ? left - MIN_BLOCK : Math.min(MAX_BLOCK, left);
    out.push(size);
    left -= size;
  }
  return out;
}

export function executionWindow(task: Task) {
  return {
    start: task.start_date ? +startOfDayInstant(task.start_date, task.timezone) : -Infinity,
    end:
      dueInstant(task)?.getTime() ??
      (task.due_date ? +startOfDayInstant(addDaysToKey(task.due_date, 1), task.timezone) : Infinity),
  };
}

export function planWeek(input: {
  tasks: Task[];
  slots: FreeSlot[];
  lastDay: DateKey;
  today: DateKey;
  /** Minutos já reservados no futuro, por tarefa. */
  reserved?: Record<string, number>;
  /** Tarefas que a pessoa desmarcou na revisão. */
  excluded?: string[];
}): PlanResult {
  const reserved = input.reserved ?? {};
  const excluded = new Set(input.excluded ?? []);
  const candidates = input.tasks.filter(
    (t) =>
      t.item_type === 'task' &&
      isOpen(t) &&
      !!t.due_date &&
      compareKeys(t.due_date, input.lastDay) <= 0 &&
      !excluded.has(t.id),
  );
  candidates.sort(
    (a, b) =>
      compareKeys(a.due_date!, b.due_date!) ||
      b.priority - a.priority ||
      (b.estimated_minutes ?? DEFAULT_TASK_MINUTES) - (a.estimated_minutes ?? DEFAULT_TASK_MINUTES),
  );

  // Cópia mutável dos horários livres, em ordem.
  const free = input.slots
    .map((s) => ({ day: s.day, start: s.start.getTime(), end: s.end.getTime() }))
    .sort((a, b) => a.start - b.start);

  const suggestions: BlockSuggestion[] = [];
  const unplaced: Task[] = [];
  const assumed: string[] = [];

  for (const task of candidates) {
    const total = task.estimated_minutes ?? DEFAULT_TASK_MINUTES;
    if (!task.estimated_minutes) assumed.push(task.id);
    const remaining = total - (reserved[task.id] ?? 0);
    if (remaining <= 0) continue;
    const parts = chunks(remaining);
    const { start: earliest, end: dueAt } = executionWindow(task);
    const placed: BlockSuggestion[] = [];
    // Tenta numa cópia: só vale se a tarefa couber inteira antes do prazo.
    const trial = free.map((s) => ({ ...s }));
    for (let i = 0; i < parts.length; i++) {
      const length = parts[i] * 60_000;
      const slot = trial.find((s) => Math.max(s.start, earliest) + length <= Math.min(s.end, dueAt));
      if (!slot) break;
      const start = Math.max(slot.start, earliest);
      if (start > slot.start) trial.push({ ...slot, end: start });
      slot.start = start + length;
      trial.sort((a, b) => a.start - b.start);
      placed.push({
        id: `${task.id}:${i}`,
        task,
        start: new Date(start),
        end: new Date(start + length),
        part: i + 1,
        parts: parts.length,
        reasons: [
          { key: 'deadline', value: task.due_date! },
          ...(task.priority >= 3 ? [{ key: 'priority' as const, value: task.priority }] : []),
          { key: 'free' },
          ...(parts.length > 1 ? [{ key: 'split' as const, value: parts.length }] : []),
        ],
      });
    }
    if (placed.length < parts.length) {
      unplaced.push(task);
    } else {
      free.splice(0, free.length, ...trial);
      suggestions.push(...placed);
    }
  }
  suggestions.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { suggestions, unplaced, assumedDuration: assumed };
}
