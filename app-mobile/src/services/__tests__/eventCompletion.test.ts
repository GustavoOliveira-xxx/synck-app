import { restoreOccurrenceCompletion } from '../eventActions';
import { enqueueOp } from '@/offline/syncEngine';
import type { CalendarEvent, Occurrence } from '@/models/types';
jest.mock('@/offline/syncEngine', () => ({ enqueueOp: jest.fn(async () => undefined) }));
jest.mock('@/offline/storage', () => ({ newId: () => 'operation' }));
const event = {
  id: 'meeting',
  calendar_id: 'calendar',
  status: 'confirmed',
  version: 1,
  recurrence_rule: null,
  exceptions: [],
} as unknown as CalendarEvent;
afterEach(() => jest.clearAllMocks());
test('desfazer recupera confirmado e compara com o estado concluído', async () => {
  await restoreOccurrenceCompletion({ event } as Occurrence);
  expect(enqueueOp).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'update',
      payload: { status: 'confirmed' },
      baseSnapshot: { status: 'completed' },
    }),
  );
});
test('desfazer conclusão de ocorrência recupera a herança da série', async () => {
  await restoreOccurrenceCompletion({
    event: { ...event, recurrence_rule: 'FREQ=WEEKLY' },
    originalDate: '2026-11-09',
  } as Occurrence);
  expect(enqueueOp).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'exception_upsert',
      payload: expect.objectContaining({ status: null, original_date: '2026-11-09' }),
    }),
  );
});
