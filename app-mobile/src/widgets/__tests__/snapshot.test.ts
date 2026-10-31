import { expandEvent } from '@/utils/recurrence';

import { makeEvent, makeTask } from '../../utils/__tests__/fixtures';
import { buildSnapshot, daysUntil, itemsOn, localToday } from '../snapshot';

const TZ = 'America/Sao_Paulo';
const occ = (overrides: Parameters<typeof makeEvent>[0]) =>
  expandEvent(makeEvent(overrides), new Date('2026-10-01T00:00:00Z'), new Date('2026-12-31T00:00:00Z'));

describe('retrato dos widgets', () => {
  const snapshot = buildSnapshot({
    occurrences: [
      ...occ({
        id: 'jantar',
        title: 'Jantar',
        description: 'Segredo da festa',
        location: 'Rua X, 10',
        starts_at: '2026-11-03T23:00:00Z',
        ends_at: '2026-11-04T01:00:00Z',
      }),
      ...occ({
        id: 'ocupado',
        title: null,
        is_masked: true,
        starts_at: '2026-11-03T12:00:00Z',
        ends_at: '2026-11-03T13:00:00Z',
      }),
      ...occ({
        id: 'cancelado',
        title: 'Cancelado',
        status: 'cancelled',
        starts_at: '2026-11-03T15:00:00Z',
        ends_at: '2026-11-03T16:00:00Z',
      }),
    ],
    tasks: [
      makeTask({ id: 't1', title: 'Pagar luz', due_date: '2026-11-03', due_time: null }),
      makeTask({
        id: 't2',
        title: 'Feita',
        due_date: '2026-11-03',
        status: 'done',
        completed_at: '2026-11-02T10:00:00Z',
      }),
    ],
    calendarColors: {},
    timezone: TZ,
    weekStartsOn: 0,
    today: '2026-11-03',
    fallbackColor: '#017A68',
  });

  it('leva só título, horário e cor (sem descrição nem local)', () => {
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain('Segredo');
    expect(json).not.toContain('Rua X');
    const jantar = snapshot.items.find((i) => i.id === 'jantar')!;
    expect([jantar.date, jantar.time, jantar.endTime]).toEqual(['2026-11-03', '20:00', '22:00']);
  });

  it('evento "ocupado" aparece sem título; cancelados e tarefas concluídas ficam de fora', () => {
    expect(snapshot.items.find((i) => i.id === 'ocupado')?.title).toBe('Ocupado');
    expect(snapshot.items.some((i) => i.id === 'cancelado')).toBe(false);
    expect(snapshot.items.some((i) => i.id === 't2')).toBe(false);
  });

  it('do dia: primeiro o que não tem horário, depois por horário', () => {
    expect(itemsOn(snapshot, '2026-11-03').map((i) => i.id)).toEqual(['t1', 'ocupado', 'jantar']);
    expect(snapshot.busyDays).toContain('2026-11-03');
  });

  it('contagem de dias', () => {
    expect(daysUntil('2026-11-03', '2026-11-15')).toBe(12);
    expect(daysUntil('2026-11-03', '2026-11-03')).toBe(0);
    expect(daysUntil('2026-11-03', '2026-11-01')).toBe(-2);
    expect(localToday(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
