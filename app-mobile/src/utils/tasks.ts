// Regras de tarefas e lembretes usadas pelas telas: prazos, atraso, visões
// inteligentes, filtros e ordenação. Funções puras (testadas em __tests__).
import { interpolate, strings } from '@/i18n';
import type { DateKey, ItemType, Task, TaskPriority, TaskStatus, TimeFormat } from '@/models/types';

import {
  addDaysToKey,
  compareKeys,
  diffDays,
  formatClock,
  formatShortDate,
  localToInstant,
  weekKeys,
  weekdayOfKey,
} from './dates';
import { normalizeText } from './text';

/** Base dos alertas de itens sem horário: 9h do dia do prazo. */
export const DEFAULT_ALERT_TIME = '09:00';

export const OPEN_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'waiting'];

export function isOpen(task: Pick<Task, 'status'>): boolean {
  return OPEN_STATUSES.includes(task.status);
}

/** "19:00:00" -> "19:00". */
export function shortTime(time: string | null | undefined): string | null {
  return time ? time.slice(0, 5) : null;
}

/** Instante do prazo (com horário) ou null. */
export function dueInstant(task: Pick<Task, 'due_date' | 'due_time' | 'timezone'>): Date | null {
  if (!task.due_date || !task.due_time) return null;
  return localToInstant(task.due_date, shortTime(task.due_time)!, task.timezone);
}

/** Instante que serve de base aos alertas (prazo, ou 9h do dia do prazo). */
export function alertBase(task: Pick<Task, 'due_date' | 'due_time' | 'timezone'>): Date | null {
  if (!task.due_date) return null;
  return localToInstant(task.due_date, shortTime(task.due_time) ?? DEFAULT_ALERT_TIME, task.timezone);
}

/** Atrasada: aberta e com o prazo vencido (dia anterior, ou hoje com horário já passado). */
export function isOverdue(
  task: Pick<Task, 'status' | 'due_date' | 'due_time' | 'timezone'>,
  today: DateKey,
  now: Date = new Date(),
): boolean {
  if (!isOpen(task) || !task.due_date) return false;
  const cmp = compareKeys(task.due_date, today);
  if (cmp < 0) return true;
  if (cmp > 0 || !task.due_time) return false;
  const at = dueInstant(task);
  return !!at && at.getTime() < now.getTime();
}

export function checklistProgress(task: Pick<Task, 'checklist'>): { done: number; total: number } {
  return { done: task.checklist.filter((c) => c.done).length, total: task.checklist.length };
}

// ---------------------------------------------------------------------
// Prioridade (identificada por texto e ícone, nunca só por cor)
// ---------------------------------------------------------------------

export const PRIORITIES: TaskPriority[] = [4, 3, 2, 1, 0];

export function priorityLabel(priority: TaskPriority): string {
  return strings.tasks.priorities[priority];
}

/** Marcas visuais: "!!!" urgente, "!!" alta, "!" média. */
export function priorityMarks(priority: TaskPriority): string {
  return priority >= 4 ? '!!!' : priority === 3 ? '!!' : priority === 2 ? '!' : '';
}

// ---------------------------------------------------------------------
// Texto do prazo
// ---------------------------------------------------------------------

export function describeDue(
  task: Pick<Task, 'due_date' | 'due_time' | 'status' | 'timezone'>,
  today: DateKey,
  timeFormat: TimeFormat = '24h',
): string | null {
  if (!task.due_date) return null;
  const d = diffDays(task.due_date, today);
  const time = shortTime(task.due_time);
  const clock = time ? formatClock(Number(time.slice(0, 2)), Number(time.slice(3, 5)), timeFormat) : null;
  let day: string;
  if (d === 0) day = strings.common.today;
  else if (d === 1) day = strings.tasks.tomorrow;
  else if (d === -1) day = strings.tasks.yesterday;
  else if (d > 1 && d < 7) day = capitalizeFirst(strings.weekdays.short[weekdayOfKey(task.due_date)]);
  else day = formatShortDate(task.due_date);
  if (isOpen(task) && d < -1) {
    return interpolate(strings.tasks.overdueBy, { n: -d });
  }
  return clock ? `${day}, ${clock}` : day;
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------------
// Visões inteligentes
// ---------------------------------------------------------------------

export type SmartView =
  | 'inbox'
  | 'today'
  | 'upcoming'
  | 'week'
  | 'overdue'
  | 'nodate'
  | 'important'
  | 'assigned'
  | 'shared'
  | 'reminders'
  | 'done';

export const SMART_VIEWS: SmartView[] = [
  'inbox',
  'today',
  'upcoming',
  'week',
  'overdue',
  'nodate',
  'important',
  'assigned',
  'shared',
  'reminders',
  'done',
];

export interface ViewContext {
  today: DateKey;
  now: Date;
  userId: string | null;
  weekStartsOn: 0 | 1;
}

/** A tarefa aparece na visão? (`list:<id>` mostra uma lista específica). */
export function inView(task: Task, view: SmartView | `list:${string}`, ctx: ViewContext): boolean {
  if (view === 'done') return !isOpen(task);
  if (!isOpen(task)) return false;
  if (view.startsWith('list:')) return task.list_id === view.slice(5);
  const due = task.due_date;
  switch (view) {
    case 'inbox':
      return task.item_type === 'task' && !task.list_id;
    case 'today':
      return (!!due && compareKeys(due, ctx.today) <= 0) || task.plan_day === ctx.today;
    case 'upcoming':
      return !!due && compareKeys(due, ctx.today) > 0 && compareKeys(due, addDaysToKey(ctx.today, 7)) <= 0;
    case 'week': {
      const days = weekKeys(ctx.today, ctx.weekStartsOn);
      return !!due && compareKeys(due, days[0]) >= 0 && compareKeys(due, days[6]) <= 0;
    }
    case 'overdue':
      return isOverdue(task, ctx.today, ctx.now);
    case 'nodate':
      return !due;
    case 'important':
      return task.priority >= 3;
    case 'assigned':
      return !!ctx.userId && task.assignee_id === ctx.userId;
    case 'shared':
      return !!task.calendar_id;
    case 'reminders':
      return task.item_type === 'reminder';
    default:
      return false;
  }
}

// ---------------------------------------------------------------------
// Filtros e ordenação
// ---------------------------------------------------------------------

export type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'nodate' | 'withdate';

export interface TaskFilters {
  priorities: TaskPriority[];
  statuses: TaskStatus[];
  tags: string[];
  /** 'me', 'unassigned', id de alguém, ou null (qualquer). */
  assignee: string | null;
  /** id da agenda, 'personal' (sem agenda) ou null (qualquer). */
  calendarId: string | null;
  listId: string | null;
  recurring: boolean | null;
  itemType: ItemType | null;
  due: DueFilter;
  query: string;
}

export const DEFAULT_TASK_FILTERS: TaskFilters = {
  priorities: [],
  statuses: [],
  tags: [],
  assignee: null,
  calendarId: null,
  listId: null,
  recurring: null,
  itemType: null,
  due: 'any',
  query: '',
};

export function activeTaskFilterCount(f: TaskFilters): number {
  let n = 0;
  if (f.priorities.length) n++;
  if (f.statuses.length) n++;
  if (f.tags.length) n++;
  if (f.assignee) n++;
  if (f.calendarId) n++;
  if (f.listId) n++;
  if (f.recurring !== null) n++;
  if (f.itemType) n++;
  if (f.due !== 'any') n++;
  return n;
}

export function matchesFilters(task: Task, f: TaskFilters, ctx: ViewContext): boolean {
  if (f.priorities.length && !f.priorities.includes(task.priority)) return false;
  if (f.statuses.length && !f.statuses.includes(task.status)) return false;
  if (f.tags.length && !f.tags.every((tag) => task.tags.includes(tag))) return false;
  if (f.assignee === 'me' && task.assignee_id !== ctx.userId) return false;
  if (f.assignee === 'unassigned' && task.assignee_id) return false;
  if (f.assignee && f.assignee !== 'me' && f.assignee !== 'unassigned' && task.assignee_id !== f.assignee)
    return false;
  if (f.calendarId === 'personal' && task.calendar_id) return false;
  if (f.calendarId && f.calendarId !== 'personal' && task.calendar_id !== f.calendarId) return false;
  if (f.listId && task.list_id !== f.listId) return false;
  if (f.recurring !== null && !!task.recurrence_rule !== f.recurring) return false;
  if (f.itemType && task.item_type !== f.itemType) return false;
  switch (f.due) {
    case 'overdue':
      if (!isOverdue(task, ctx.today, ctx.now)) return false;
      break;
    case 'today':
      if (task.due_date !== ctx.today) return false;
      break;
    case 'week':
      if (!inView(task, 'week', ctx)) return false;
      break;
    case 'nodate':
      if (task.due_date) return false;
      break;
    case 'withdate':
      if (!task.due_date) return false;
      break;
    default:
      break;
  }
  if (f.query.trim()) {
    const q = normalizeText(f.query);
    const hay = normalizeText(
      [task.title, task.description, ...task.tags, ...task.checklist.map((c) => c.title)].join(' '),
    );
    if (!hay.includes(q)) return false;
  }
  return true;
}

export type TaskSort = 'manual' | 'due' | 'priority' | 'created' | 'updated' | 'title';

export const TASK_SORTS: TaskSort[] = ['manual', 'due', 'priority', 'created', 'updated', 'title'];

/** Prazo como número comparável (sem prazo vai para o fim). */
function dueRank(task: Task): string {
  if (!task.due_date) return '9999-99-99 99:99';
  return `${task.due_date} ${shortTime(task.due_time) ?? '99:99'}`;
}

export function sortTasks(list: Task[], sort: TaskSort): Task[] {
  const byTitle = (a: Task, b: Task) => a.title.localeCompare(b.title, 'pt-BR');
  const cmp: Record<TaskSort, (a: Task, b: Task) => number> = {
    manual: (a, b) => a.position - b.position || byTitle(a, b),
    due: (a, b) => dueRank(a).localeCompare(dueRank(b)) || b.priority - a.priority || byTitle(a, b),
    priority: (a, b) => b.priority - a.priority || dueRank(a).localeCompare(dueRank(b)) || byTitle(a, b),
    created: (a, b) => b.created_at.localeCompare(a.created_at),
    updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
    title: byTitle,
  };
  return [...list].sort(cmp[sort]);
}

/** Posição para inserir entre dois vizinhos (ordenação manual sem renumerar tudo). */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return Date.now() / 1000;
  if (before === null) return (after as number) - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}

/** Etiquetas usadas, da mais comum para a menos comum. */
export function tagsInUse(tasks: Task[]): string[] {
  const count = new Map<string, number>();
  for (const t of tasks) for (const tag of t.tags) count.set(tag, (count.get(tag) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/**
 * Número no ícone do app: tarefas e lembretes abertos da visão "Hoje" (prazo
 * até hoje, atrasados inclusive, ou planejados para hoje). O servidor conta
 * igual em private.badge_count.
 */
export function badgeCount(tasks: Task[], today: DateKey): number {
  const ctx: ViewContext = { today, now: new Date(), userId: null, weekStartsOn: 0 };
  return tasks.filter((t) => inView(t, 'today', ctx)).length;
}

/** Quantas tarefas abertas em cada visão (para os contadores). */
export function viewCounts(tasks: Task[], ctx: ViewContext): Record<SmartView, number> {
  const counts = Object.fromEntries(SMART_VIEWS.map((v) => [v, 0])) as Record<SmartView, number>;
  for (const t of tasks) for (const v of SMART_VIEWS) if (v !== 'done' && inView(t, v, ctx)) counts[v] += 1;
  return counts;
}
