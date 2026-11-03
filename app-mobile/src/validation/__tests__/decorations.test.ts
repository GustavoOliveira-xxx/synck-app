import { makeEvent, makeTask } from '@/utils/__tests__/fixtures';
import { changedFields, eventToForm, formToFields } from '../event';
import { changedTaskFields, formToTaskFields, taskToForm } from '../task';
import { makeOp, overlayPending } from '@/offline/outbox';
import { overlayItems } from '@/offline/itemOverlay';

test('editar só a decoração preserva os campos e permite removê-la', () => {
  const event = makeEvent({ decoration: 'decor-sol' });
  const form = eventToForm(event);
  expect(form.decoration).toBe('decor-sol');
  expect(changedFields(event, formToFields({ ...form, decoration: 'decor-flor' }))).toEqual({
    decoration: 'decor-flor',
  });
  const task = makeTask({ decoration: 'decor-sol' });
  expect(changedTaskFields(task, formToTaskFields({ ...taskToForm(task), decoration: null }))).toEqual({
    decoration: null,
  });
});
test('desenhos aparecem imediatamente na fila offline e sobrevivem à serialização', () => {
  const operation = (entity: 'event' | 'task' | 'note' | 'habit', id: string) =>
    makeOp({
      id: `op-${id}`,
      entity,
      kind: 'update',
      entityId: id,
      calendarId: 'cal-1',
      payload: { decoration: 'decor-lua' },
      baseVersion: 1,
    });
  const event = makeEvent();
  const task = makeTask();
  const queue = JSON.parse(JSON.stringify([operation('event', event.id), operation('task', task.id)]));
  expect(overlayPending({ [event.id]: event }, queue, 'user-a')[event.id].decoration).toBe('decor-lua');
  const items = overlayItems(
    { tasks: { [task.id]: task }, notes: {}, lists: {}, habits: {}, checkins: [] },
    queue,
    'user-a',
    '2026-11-03',
  );
  expect(items.tasks[task.id].decoration).toBe('decor-lua');
});
