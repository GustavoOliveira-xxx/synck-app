// Formulário de tarefas e lembretes: valores iniciais, validação e
// conversão para os campos enviados ao servidor.
import { t } from '@/i18n';
import type {
  DateKey,
  ItemType,
  RecurrenceMode,
  Task,
  TaskFields,
  TaskPriority,
  TaskPrivacy,
  TaskStatus,
} from '@/models/types';
import { isValidDateKey } from '@/utils/dates';
import { parseRule, serializeRule, type RecurrenceRule } from '@/utils/recurrence';
import { isValidForMode } from '@/utils/taskRecurrence';
import { shortTime } from '@/utils/tasks';

import type { FieldErrors } from './auth';
import { isValidUrl } from './event';

export interface ChecklistDraft {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskForm {
  decoration?: string | null;
  itemType: ItemType;
  title: string;
  description: string;
  calendarId: string | null;
  listId: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: DateKey | null;
  dueTime: string | null;
  startDate: DateKey | null;
  estimatedMinutes: number | null;
  recurrence: RecurrenceRule | null;
  recurrenceMode: RecurrenceMode;
  assigneeId: string | null;
  participantIds: string[];
  privacy: TaskPrivacy;
  tags: string[];
  links: string[];
  alerts: number[];
  checklist: ChecklistDraft[];
  timezone: string;
}

export type TaskFormField =
  'title' | 'description' | 'due' | 'start' | 'recurrence' | 'links' | 'tags' | 'alerts';

export function newTaskForm(itemType: ItemType, timezone: string, options: Partial<TaskForm> = {}): TaskForm {
  return {
    itemType,
    title: '',
    description: '',
    calendarId: null,
    listId: null,
    priority: 0,
    status: 'pending',
    dueDate: null,
    dueTime: null,
    startDate: null,
    estimatedMinutes: null,
    recurrence: null,
    recurrenceMode: 'calendar',
    assigneeId: null,
    participantIds: [],
    privacy: 'members',
    tags: [],
    links: [],
    alerts: itemType === 'reminder' ? [0] : [],
    checklist: [],
    timezone,
    ...options,
  };
}

export function taskToForm(task: Task): TaskForm {
  return {
    decoration: task.decoration ?? null,
    itemType: task.item_type,
    title: task.title,
    description: task.description ?? '',
    calendarId: task.calendar_id,
    listId: task.list_id,
    priority: task.priority,
    status: task.status,
    dueDate: task.due_date,
    dueTime: shortTime(task.due_time),
    startDate: task.start_date,
    estimatedMinutes: task.estimated_minutes,
    recurrence: parseRule(task.recurrence_rule),
    recurrenceMode: task.recurrence_mode,
    assigneeId: task.assignee_id,
    participantIds: task.participant_ids,
    privacy: task.privacy,
    tags: task.tags,
    links: task.links,
    alerts: task.my_alerts,
    checklist: task.checklist.map((c) => ({ id: c.id, title: c.title, done: c.done })),
    timezone: task.timezone,
  };
}

/** "Casa, #mercado, estudo" -> ["casa", "mercado", "estudo"]. */
export function parseTags(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[,;\s]+/)
        .map((x) => x.replace(/^#/, '').trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function validateTaskForm(form: TaskForm): FieldErrors<TaskFormField> {
  const e: FieldErrors<TaskFormField> = {};
  const title = form.title.trim();
  if (!title) e.title = t('validation.required');
  else if (title.length > 200) e.title = t('validation.tooLong', { max: 200 });
  if (form.description.length > 5000) e.description = t('validation.tooLong', { max: 5000 });
  if (form.dueDate && !isValidDateKey(form.dueDate)) e.due = t('validation.invalidDate');
  if (form.dueTime && !form.dueDate) e.due = t('tasks.addDue');
  if (form.itemType === 'reminder' && !form.dueDate && form.recurrence) e.due = t('tasks.repeatNeedsDate');
  if (form.startDate && form.dueDate && form.startDate > form.dueDate)
    e.start = t('validation.endBeforeStart');
  if (form.recurrence) {
    if (!form.dueDate) e.recurrence = t('tasks.repeatNeedsDate');
    else if (!isValidForMode(serializeRule(form.recurrence), form.recurrenceMode))
      e.recurrence = t('errors.invalidRecurrence');
    if (form.recurrence.until && form.dueDate && form.recurrence.until < form.dueDate)
      e.recurrence = t('validation.untilBeforeStart');
  }
  if (form.links.length > 5 || form.links.some((l) => !isValidUrl(l))) e.links = t('errors.invalidLink');
  if (form.tags.length > 10 || form.tags.some((x) => x.length > 30)) e.tags = t('errors.invalidTag');
  if (form.alerts.length > 5) e.alerts = t('validation.tooManyReminders');
  return e;
}

/** Campos enviados ao servidor (sem alertas, participantes nem etapas). */
export function formToTaskFields(form: TaskForm): Omit<TaskFields, 'position'> {
  const due = form.dueDate || null;
  return {
    item_type: form.itemType,
    calendar_id: form.calendarId,
    list_id: form.listId,
    title: form.title.trim(),
    decoration: form.decoration ?? null,
    description: form.description.trim() || null,
    links: form.links.map((l) => l.trim()).filter(Boolean),
    tags: form.tags,
    start_date: form.startDate,
    due_date: due,
    due_time: due ? form.dueTime : null,
    timezone: form.timezone,
    estimated_minutes: form.estimatedMinutes,
    priority: form.priority,
    status: form.status,
    recurrence_rule: due && form.recurrence ? serializeRule(form.recurrence) : null,
    recurrence_mode: form.recurrenceMode,
    assignee_id: form.calendarId ? form.assigneeId : null,
    privacy: form.calendarId ? form.privacy : 'members',
  };
}

const COMPARED: (keyof Omit<TaskFields, 'position'>)[] = [
  'decoration',
  'item_type',
  'calendar_id',
  'list_id',
  'title',
  'description',
  'links',
  'tags',
  'start_date',
  'due_date',
  'due_time',
  'timezone',
  'estimated_minutes',
  'priority',
  'status',
  'recurrence_rule',
  'recurrence_mode',
  'assignee_id',
  'privacy',
];

function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  if (typeof a === 'string' && typeof b === 'string' && /^\d{2}:\d{2}/.test(a) && /^\d{2}:\d{2}/.test(b))
    return a.slice(0, 5) === b.slice(0, 5);
  return (a ?? null) === (b ?? null);
}

/** Só o que mudou em relação à tarefa original. */
export function changedTaskFields(task: Task, fields: Omit<TaskFields, 'position'>): Partial<TaskFields> {
  const out: Record<string, unknown> = {};
  for (const key of COMPARED) if (!same(task[key], fields[key])) out[key] = fields[key];
  return out as Partial<TaskFields>;
}
