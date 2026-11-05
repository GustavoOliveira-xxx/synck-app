// "O que você pretende fazer hoje?": quando perguntar e o que sugerir, a
// partir do que a pessoa já cadastra e repete (tarefas recorrentes, hábitos,
// o que costuma concluir em certos dias da semana).
import type { DateKey, Habit, Task } from '@/models/types';

import { addDaysToKey, compareKeys, diffDays, toDateKey, weekdayOfKey } from './dates';
import { parseRule, seriesDates } from './recurrence';
import { isOpen } from './tasks';
import { normalizeText } from './text';

/** Pergunta só na primeira abertura do dia, se a pessoa não desligou. */
export function shouldAskToday(options: {
  enabled: boolean;
  today: DateKey;
  checkins: DateKey[];
  dismissedOn: DateKey | null;
}): boolean {
  if (!options.enabled) return false;
  if (options.dismissedOn === options.today) return false;
  return !options.checkins.includes(options.today);
}

/** O hábito tem dia hoje? */
export function habitDueOn(habit: Habit, day: DateKey): boolean {
  const schedule = habit.schedule_history?.find((s) => day < s.until) ?? habit;
  if (schedule.status !== 'active') return false;
  const rule = parseRule(schedule.recurrence_rule);
  if (!rule || compareKeys(day, schedule.start_date) < 0) return false;
  for (const d of seriesDates(rule, schedule.start_date, addDaysToKey(day, -7))) {
    if (d === day) return true;
    if (compareKeys(d, day) > 0) return false;
  }
  return false;
}

export function habitDoneOn(habit: Habit, day: DateKey, userId: string | null): boolean {
  return habit.logs.some((l) => l.day === day && l.user_id === userId);
}

/** Dias seguidos (até hoje) em que o hábito foi feito, contando só os dias do hábito. */
export function habitStreak(habit: Habit, today: DateKey, userId: string | null): number {
  let n = 0;
  let day = today;
  const dates = new Set(habit.logs.filter((l) => l.user_id === userId && l.day <= today).map((l) => l.day));
  const first = [...dates].sort()[0];
  while (first && day >= first) {
    if (habitDueOn(habit, day)) {
      if (dates.has(day)) n += 1;
      else if (day !== today) break;
    }
    day = addDaysToKey(day, -1);
  }
  return n;
}

export type SuggestionReason =
  | { key: 'habit' }
  | { key: 'recurring'; rule: string }
  | { key: 'weekday'; weekday: number }
  | { key: 'frequent'; n: number }
  | { key: 'important' }
  | { key: 'soon'; days: number };

export interface DaySuggestion {
  id: string;
  kind: 'task' | 'habit' | 'title';
  task?: Task;
  habit?: Habit;
  title: string;
  reason: SuggestionReason;
}

/** Sugestões para o dia, sem repetir o que já está planejado ou com prazo hoje. */
export function suggestForToday(input: {
  tasks: Task[];
  habits: Habit[];
  today: DateKey;
  timezone: string;
  userId: string | null;
  limit?: number;
}): DaySuggestion[] {
  const { today, userId } = input;
  const out: DaySuggestion[] = [];
  const taken = new Set<string>();
  const add = (s: DaySuggestion) => {
    const k = normalizeText(s.title);
    if (taken.has(k)) return;
    taken.add(k);
    out.push(s);
  };
  const open = input.tasks.filter(isOpen);
  for (const t of open) if (t.plan_day === today || t.due_date === today) taken.add(normalizeText(t.title));

  for (const h of input.habits) {
    if (habitDueOn(h, today) && !habitDoneOn(h, today, userId)) {
      add({ id: `habit:${h.id}`, kind: 'habit', habit: h, title: h.title, reason: { key: 'habit' } });
    }
  }
  for (const t of open) {
    if (!t.recurrence_rule || !t.due_date) continue;
    const days = diffDays(t.due_date, today);
    if (days > 0 && days <= 3) {
      add({
        id: `task:${t.id}`,
        kind: 'task',
        task: t,
        title: t.title,
        reason: { key: 'recurring', rule: t.recurrence_rule },
      });
    }
  }
  // O que a pessoa costuma concluir neste dia da semana (últimos 30 dias).
  const weekday = weekdayOfKey(today);
  const byTitle = new Map<string, { title: string; count: number; sameWeekday: number }>();
  for (const t of input.tasks) {
    if (t.status !== 'done' || !t.completed_at || t.recurrence_rule) continue;
    const day = toDateKey(new Date(t.completed_at), input.timezone);
    if (diffDays(today, day) > 35 || day === today) continue;
    const k = normalizeText(t.title);
    const entry = byTitle.get(k) ?? { title: t.title, count: 0, sameWeekday: 0 };
    entry.count += 1;
    if (weekdayOfKey(day) === weekday) entry.sameWeekday += 1;
    byTitle.set(k, entry);
  }
  for (const [k, e] of [...byTitle.entries()].sort(
    (a, b) => b[1].sameWeekday - a[1].sameWeekday || b[1].count - a[1].count,
  )) {
    if (open.some((t) => normalizeText(t.title) === k)) continue;
    if (e.sameWeekday >= 1)
      add({ id: `title:${k}`, kind: 'title', title: e.title, reason: { key: 'weekday', weekday } });
    else if (e.count >= 2)
      add({ id: `title:${k}`, kind: 'title', title: e.title, reason: { key: 'frequent', n: e.count } });
  }
  for (const t of open) {
    if (t.due_date) {
      const days = diffDays(t.due_date, today);
      if (days > 0 && days <= 2 && !t.recurrence_rule) {
        add({ id: `task:${t.id}`, kind: 'task', task: t, title: t.title, reason: { key: 'soon', days } });
      }
    } else if (t.priority >= 3 && t.item_type === 'task') {
      add({ id: `task:${t.id}`, kind: 'task', task: t, title: t.title, reason: { key: 'important' } });
    }
  }
  return out.slice(0, input.limit ?? 8);
}
