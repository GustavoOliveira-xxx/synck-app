import {
  routineBlocks,
  routineConflicts,
  routineOccurrences,
  routineBusy,
  validRoutine,
  type RoutinePeriod,
} from '../routine';
import { freeSlots, startOptions } from '../freeTime';
import { instantToLocal, localToInstant } from '../dates';

const tz = 'America/Sao_Paulo';
const monday = '2026-11-09';
const work: RoutinePeriod = {
  id: 'work',
  kind: 'work',
  title: 'Trabalho',
  days: [1, 2, 3, 4, 5],
  start: '09:00',
  end: '18:00',
  timezone: tz,
  enabled: true,
};
const at = (day: string, time: string) => localToInstant(day, time, tz).getTime();

test('rotina aceita turnos e rejeita dias, horários e fusos inválidos', () => {
  expect(validRoutine(work)).toBe(true);
  for (const patch of [
    { days: [] },
    { days: [1, 1] },
    { days: [7] },
    { start: '25:00' },
    { end: '09:00' },
    { title: ' ' },
    { timezone: 'inexistente' },
  ])
    expect(validRoutine({ ...work, ...patch })).toBe(false);
});
test('sono de domingo ocupa a manhã de segunda sem duplicar intervalos', () => {
  const busy = routineBusy([{ ...work, kind: 'sleep', days: [0], start: '23:00', end: '07:00' }], [monday]);
  expect(busy).toEqual([{ start: at('2026-11-08', '23:00'), end: at(monday, '07:00') }]);
  const slots = freeSlots(busy, [monday], tz, '00:00', '10:00');
  expect(instantToLocal(slots[0].start, tz).time).toBe('07:00');
});
test('pausar período libera horários e finais de semana ficam livres', () => {
  expect(routineBusy([{ ...work, enabled: false }], [monday])).toEqual([]);
  const slots = freeSlots(routineBusy([work], ['2026-11-08']), ['2026-11-08'], tz, '08:00', '22:00');
  expect(slots[0].minutes).toBe(840);
});
test('eventos e turnos sobrepostos deixam apenas os intervalos que comportam a duração', () => {
  const busy = [
    ...routineBusy([work, { ...work, id: 'school', start: '17:00', end: '20:00' }], [monday]),
    { start: at(monday, '08:00'), end: at(monday, '08:30') },
  ];
  const slots = freeSlots(busy, [monday], tz, '08:00', '22:00', { minMinutes: 60 });
  expect(startOptions(slots, 60, 15, 1)).toEqual([{ start: at(monday, '20:00'), end: at(monday, '21:00') }]);
});
test('primeira sugestão preserva minutos livres exatos e descarta horários passados', () => {
  const slots = freeSlots(
    [{ start: at(monday, '08:00'), end: at(monday, '10:10') }],
    [monday],
    tz,
    '08:00',
    '22:00',
    { now: localToInstant(monday, '09:20', tz), minMinutes: 60 },
  );
  expect(startOptions(slots, 60, 15, 2)).toEqual([
    { start: at(monday, '10:10'), end: at(monday, '11:10') },
    { start: at(monday, '10:15'), end: at(monday, '11:15') },
  ]);
});
test('dia cheio não inventa disponibilidade', () => {
  expect(
    freeSlots(
      routineBusy([{ ...work, start: '08:00', end: '22:00' }], [monday]),
      [monday],
      tz,
      '08:00',
      '22:00',
    ),
  ).toEqual([]);
});
test('rotina mantém fuso de origem quando o usuário viaja', () => {
  const busy = routineBusy([work], [monday]);
  const mondayShift = busy.find((x) => x.start === at(monday, '09:00'))!;
  expect(instantToLocal(new Date(mondayShift.start), 'Europe/Lisbon').time).toBe('12:00');
});

test('liberar um dia não libera a série e restaurar recupera o bloco', () => {
  const changed = { ...work, exceptions: [{ original_date: monday, action: 'skip' as const }] };
  expect(routineConflicts([changed], at(monday, '10:00'), at(monday, '11:00'))).toHaveLength(0);
  expect(routineConflicts([changed], at('2026-11-10', '10:00'), at('2026-11-10', '11:00'))).toHaveLength(1);
  expect(routineConflicts([work], at(monday, '10:00'), at(monday, '11:00'))).toHaveLength(1);
});
test('ocorrência movida de outra semana ocupa só o destino', () => {
  const changed = {
    ...work,
    exceptions: [
      {
        original_date: monday,
        action: 'move' as const,
        starts_at: new Date(at('2026-11-22', '14:00')).toISOString(),
        ends_at: new Date(at('2026-11-22', '15:00')).toISOString(),
      },
    ],
  };
  expect(routineConflicts([changed], at(monday, '10:00'), at(monday, '11:00'))).toHaveLength(0);
  const blocks = routineBlocks([changed], ['2026-11-22']);
  expect(blocks.some((b) => b.date === monday && b.start === at('2026-11-22', '14:00'))).toBe(true);
  expect(
    routineOccurrences([changed], new Date(at('2026-11-22', '00:00')), new Date(at('2026-11-23', '00:00')))[0]
      .routine?.date,
  ).toBe(monday);
});
test('limites adjacentes não conflitam; exceção noturna libera a manhã seguinte', () => {
  expect(routineConflicts([work], at(monday, '18:00'), at(monday, '19:00'))).toHaveLength(0);
  const sleep = {
    ...work,
    start: '23:00',
    end: '07:00',
    days: [0],
    exceptions: [{ original_date: '2026-11-08', action: 'skip' as const }],
  };
  expect(routineConflicts([sleep], at(monday, '06:00'), at(monday, '07:00'))).toHaveLength(0);
});
