import { expandEvent } from '../recurrence';
import type { CalendarEvent } from '@/models/types';
const event = {
  id: 'meeting',
  title: 'Reunião',
  starts_at: '2026-11-09T12:00:00Z',
  ends_at: '2026-11-09T13:00:00Z',
  timezone: 'America/Sao_Paulo',
  all_day: false,
  start_date: null,
  end_date: null,
  recurrence_rule: 'FREQ=WEEKLY;COUNT=3',
  status: 'planned',
  exceptions: [{ original_date: '2026-11-09', is_cancelled: false, status: 'completed' }],
} as CalendarEvent;
test('conclusão pertence somente à ocorrência selecionada', () => {
  const list = expandEvent(event, new Date('2026-11-01'), new Date('2026-12-01'));
  expect(list.map((o) => o.event.status)).toEqual(['completed', 'planned', 'planned']);
  expect(event.status).toBe('planned');
});
