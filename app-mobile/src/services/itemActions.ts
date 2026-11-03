// Ações de tarefas, lembretes, listas, anotações, hábitos e do plano do dia.
// Todas passam pela fila offline: funcionam sem internet e são enviadas
// assim que possível, com o mesmo controle de versão dos eventos.
import { makeOp, type OpEntity, type OpKind } from '@/offline/outbox';
import { newId } from '@/offline/storage';
import { enqueueOp } from '@/offline/syncEngine';
import type {
  ChecklistItem,
  DateKey,
  Habit,
  HabitStatus,
  Note,
  Task,
  TaskFields,
  TaskList,
  TaskStatus,
} from '@/models/types';
import { positionBetween } from '@/utils/tasks';
import { changedTaskFields, formToTaskFields, type TaskForm } from '@/validation/task';

function queue(
  entity: OpEntity,
  kind: OpKind,
  entityId: string,
  calendarId: string | null,
  payload: Record<string, unknown>,
  base?: { version: number; snapshot?: Record<string, unknown> },
) {
  return enqueueOp(
    makeOp({
      id: newId(),
      entity,
      kind,
      entityId,
      calendarId,
      payload,
      baseVersion: base?.version ?? null,
      baseSnapshot: base?.snapshot ?? null,
    }),
  );
}

const sameList = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

function snapshotOf(task: Task, changes: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(changes);
  if (keys.some((k) => ['due_date', 'due_time', 'timezone'].includes(k)))
    keys.push('due_date', 'due_time', 'timezone');
  return Object.fromEntries([...new Set(keys)].map((k) => [k, task[k as keyof Task] ?? null]));
}

// ------------------------------------------------------------------ tarefas

export async function createTask(form: TaskForm, extra: { planDay?: DateKey | null } = {}): Promise<string> {
  const id = newId();
  const fields = formToTaskFields(form);
  const payload: Record<string, unknown> = { ...fields, position: Date.now() / 1000 };
  if (form.alerts.length && fields.due_date) payload.alerts = form.alerts;
  if (form.participantIds.length && fields.calendar_id) payload.participant_ids = form.participantIds;
  if (form.checklist.length) {
    payload.checklist = form.checklist
      .filter((c) => c.title.trim())
      .map((c, i) => ({ id: c.id, title: c.title.trim(), done: c.done, position: i + 1 }));
  }
  if (extra.planDay) payload.plan_day = extra.planDay;
  await queue('task', 'create', id, fields.calendar_id, payload);
  return id;
}

export async function updateTask(task: Task, form: TaskForm): Promise<void> {
  const changes = changedTaskFields(task, formToTaskFields(form));
  if (Object.keys(changes).length) {
    await queue('task', 'update', task.id, task.calendar_id, changes, {
      version: task.version,
      snapshot: snapshotOf(task, changes),
    });
  }
  const calendarId = form.calendarId;
  if (!sameList(form.alerts, task.my_alerts)) {
    await queue('task', 'alerts_set', task.id, calendarId, { minutes: form.dueDate ? form.alerts : [] });
  }
  if (calendarId && !sameList(form.participantIds, task.participant_ids)) {
    await queue('task', 'participants_set', task.id, calendarId, { user_ids: form.participantIds });
  }
}

/** Altera campos soltos (ex.: prioridade, prazo), com controle de versão. */
export async function patchTask(task: Task, changes: Partial<TaskFields>): Promise<void> {
  await queue('task', 'update', task.id, task.calendar_id, changes, {
    version: task.version,
    snapshot: snapshotOf(task, changes),
  });
}

export async function setTaskStatus(task: Task, status: TaskStatus): Promise<void> {
  await patchTask(task, { status });
}

/** Concluir (em tarefas recorrentes, a ocorrência atual; o prazo avança). */
export async function completeTask(task: Task, occurrence?: DateKey | null): Promise<void> {
  await queue('task', 'complete', task.id, task.calendar_id, {
    occurrence_date: occurrence ?? (task.recurrence_rule ? task.due_date : null),
  });
}

/** Desfazer a conclusão (em recorrentes, da ocorrência informada). */
export async function reopenTask(task: Task, occurrence?: DateKey | null): Promise<void> {
  await queue('task', 'reopen', task.id, task.calendar_id, { occurrence_date: occurrence ?? null });
}

export async function postponeTask(task: Task, date: DateKey): Promise<void> {
  await patchTask(task, { due_date: date, ...(task.due_date ? {} : { due_time: null }) });
}

export async function deleteTask(task: Task): Promise<void> {
  await queue('task', 'delete', task.id, task.calendar_id, {}, { version: task.version });
}

export async function restoreTask(task: Pick<Task, 'id' | 'calendar_id'>): Promise<void> {
  await queue('task', 'restore', task.id, task.calendar_id, {});
}

export async function setTaskPlan(task: Task, day: DateKey | null): Promise<void> {
  await queue('task', 'plan_set', task.id, task.calendar_id, { day });
}

export async function setTaskAlerts(task: Task, minutes: number[]): Promise<void> {
  await queue('task', 'alerts_set', task.id, task.calendar_id, { minutes });
}

// ---------------------------------------------------------------- etapas

export async function addStep(task: Task, title: string): Promise<void> {
  const last = task.checklist.length ? task.checklist[task.checklist.length - 1].position : null;
  await queue('task', 'checklist_upsert', task.id, task.calendar_id, {
    id: newId(),
    title: title.trim(),
    done: false,
    position: positionBetween(last, null),
  });
}

export async function toggleStep(task: Task, item: ChecklistItem): Promise<void> {
  await queue('task', 'checklist_upsert', task.id, task.calendar_id, { id: item.id, done: !item.done });
}

export async function renameStep(task: Task, item: ChecklistItem, title: string): Promise<void> {
  await queue('task', 'checklist_upsert', task.id, task.calendar_id, { id: item.id, title: title.trim() });
}

export async function deleteStep(task: Task, item: ChecklistItem): Promise<void> {
  await queue('task', 'checklist_delete', task.id, task.calendar_id, { id: item.id });
}

/** Sobe ou desce uma etapa (alternativa acessível a arrastar). */
export async function moveStep(task: Task, item: ChecklistItem, direction: -1 | 1): Promise<void> {
  const list = task.checklist;
  const i = list.findIndex((c) => c.id === item.id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return;
  const neighbor = list[j];
  const beyond = list[j + direction];
  const position =
    direction < 0
      ? positionBetween(beyond?.position ?? null, neighbor.position)
      : positionBetween(neighbor.position, beyond?.position ?? null);
  await queue('task', 'checklist_upsert', task.id, task.calendar_id, { id: item.id, position });
}

/** Sobe ou desce uma tarefa na ordem manual. */
export async function moveTask(task: Task, ordered: Task[], direction: -1 | 1): Promise<void> {
  const i = ordered.findIndex((x) => x.id === task.id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ordered.length) return;
  const neighbor = ordered[j];
  const beyond = ordered[j + direction];
  const position =
    direction < 0
      ? positionBetween(beyond?.position ?? null, neighbor.position)
      : positionBetween(neighbor.position, beyond?.position ?? null);
  await patchTask(task, { position });
}

// ------------------------------------------------------------------ listas

export async function createList(input: Pick<TaskList, 'name' | 'calendar_id' | 'color'>): Promise<string> {
  const id = newId();
  await queue('list', 'create', id, input.calendar_id, {
    name: input.name.trim(),
    calendar_id: input.calendar_id,
    color: input.color,
    position: Date.now() / 1000,
  });
  return id;
}

export async function updateList(
  list: TaskList,
  changes: Partial<Pick<TaskList, 'name' | 'color' | 'position'>>,
) {
  await queue('list', 'update', list.id, list.calendar_id, changes, { version: list.version });
}

export async function deleteList(list: TaskList): Promise<void> {
  await queue('list', 'delete', list.id, list.calendar_id, {});
}

// --------------------------------------------------------------- anotações

export async function createNote(
  input: Pick<Note, 'title' | 'body' | 'calendar_id' | 'pinned'> &
    Partial<Pick<Note, 'event_id' | 'task_id' | 'decoration'>>,
): Promise<string> {
  const id = newId();
  await queue('note', 'create', id, input.calendar_id, {
    title: input.title?.trim() || null,
    body: input.body,
    decoration: input.decoration ?? null,
    calendar_id: input.calendar_id,
    pinned: input.pinned,
    event_id: input.event_id ?? null,
    task_id: input.task_id ?? null,
  });
  return id;
}

export async function updateNote(
  note: Note,
  changes: Partial<Pick<Note, 'title' | 'body' | 'pinned' | 'decoration'>>,
) {
  await queue('note', 'update', note.id, note.calendar_id, changes, {
    version: note.version,
    snapshot: Object.fromEntries(Object.keys(changes).map((k) => [k, note[k as keyof Note] ?? null])),
  });
}

export async function deleteNote(note: Note): Promise<void> {
  await queue('note', 'delete', note.id, note.calendar_id, {});
}

// ------------------------------------------------------------------ hábitos

export async function createHabit(
  input: Pick<
    Habit,
    | 'title'
    | 'description'
    | 'calendar_id'
    | 'recurrence_rule'
    | 'start_date'
    | 'show_streak'
    | 'color'
    | 'decoration'
  >,
): Promise<string> {
  const id = newId();
  await queue('habit', 'create', id, input.calendar_id, { ...input });
  return id;
}

export async function updateHabit(
  habit: Habit,
  changes: Partial<
    Pick<Habit, 'title' | 'description' | 'recurrence_rule' | 'show_streak' | 'color' | 'decoration'>
  > & {
    status?: HabitStatus;
  },
) {
  await queue('habit', 'update', habit.id, habit.calendar_id, changes, { version: habit.version });
}

export async function deleteHabit(habit: Habit): Promise<void> {
  await queue('habit', 'delete', habit.id, habit.calendar_id, {});
}

export async function logHabit(habit: Habit, day: DateKey, done: boolean): Promise<void> {
  await queue('habit', 'log_set', habit.id, habit.calendar_id, { day, done });
}

// ----------------------------------------------------------- plano do dia

/** Registra que a pessoa já respondeu "O que você pretende fazer hoje?". */
export async function markCheckin(day: DateKey): Promise<void> {
  await queue('checkin', 'mark', newId(), null, { day });
}
