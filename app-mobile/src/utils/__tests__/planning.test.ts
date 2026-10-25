import { expandEvent } from '../recurrence';
import {
  busyFromOccurrences,
  commonFree,
  freeSlots,
  mergeIntervals,
  startOptions,
  totalMinutes,
} from '../freeTime';
import { chunks, planWeek } from '../planner';
import { layoutDay, minutesIntoDay } from '../timeGrid';
import { habitDueOn, habitStreak, shouldAskToday, suggestForToday } from '../dailyPlan';
import { summarizeWeek } from '../weekSummary';
import type { Habit } from '@/models/types';

import { makeEvent, makeTask } from './fixtures';

const tz = 'America/Sao_Paulo';
const at = (iso: string) => new Date(iso).getTime();

describe('horários livres', () => {
  it('junta ocupações e calcula o livre dentro da janela do dia', () => {
    expect(
      mergeIntervals([
        { start: 1, end: 5 },
        { start: 4, end: 8 },
        { start: 10, end: 12 },
      ]),
    ).toEqual([
      { start: 1, end: 8 },
      { start: 10, end: 12 },
    ]);
    // Quarta 28/10: ocupado das 9h às 12h e das 14h às 18h (horário de Brasília).
    const busy = [
      { start: at('2026-10-28T12:00:00Z'), end: at('2026-10-28T15:00:00Z') },
      { start: at('2026-10-28T17:00:00Z'), end: at('2026-10-28T21:00:00Z') },
    ];
    const slots = freeSlots(busy, ['2026-10-28'], tz, '08:00', '22:00');
    expect(slots.map((s) => [s.start.toISOString(), s.minutes])).toEqual([
      ['2026-10-28T11:00:00.000Z', 60],
      ['2026-10-28T15:00:00.000Z', 120],
      ['2026-10-28T21:00:00.000Z', 240],
    ]);
    expect(totalMinutes(slots)).toBe(420);
    // O que já passou não conta.
    const later = freeSlots(busy, ['2026-10-28'], tz, '08:00', '22:00', {
      now: new Date('2026-10-28T22:30:00Z'),
    });
    expect(later.map((s) => s.minutes)).toEqual([150]);
    // Agora quebrado (19:26 em Brasília): o livre começa no próximo quarto de hora.
    const quebrado = freeSlots(busy, ['2026-10-28'], tz, '08:00', '22:00', {
      now: new Date('2026-10-28T22:26:00Z'),
    });
    expect(quebrado.map((s) => [s.start.toISOString(), s.minutes])).toEqual([
      ['2026-10-28T22:30:00.000Z', 150],
    ]);
  });

  it('eventos de dia inteiro e cancelados não ocupam horário', () => {
    const occ = [
      ...expandEvent(
        makeEvent({
          id: 'a',
          all_day: true,
          start_date: '2026-10-28',
          end_date: '2026-10-28',
          starts_at: '2026-10-28T03:00:00Z',
          ends_at: '2026-10-29T03:00:00Z',
        }),
        new Date('2026-10-27T00:00:00Z'),
        new Date('2026-10-30T00:00:00Z'),
      ),
      ...expandEvent(
        makeEvent({
          id: 'b',
          status: 'cancelled',
          starts_at: '2026-10-28T13:00:00Z',
          ends_at: '2026-10-28T14:00:00Z',
        }),
        new Date('2026-10-27T00:00:00Z'),
        new Date('2026-10-30T00:00:00Z'),
      ),
      ...expandEvent(
        makeEvent({ id: 'c', starts_at: '2026-10-28T13:00:00Z', ends_at: '2026-10-28T14:00:00Z' }),
        new Date('2026-10-27T00:00:00Z'),
        new Date('2026-10-30T00:00:00Z'),
      ),
    ];
    expect(busyFromOccurrences(occ)).toEqual([
      { start: at('2026-10-28T13:00:00Z'), end: at('2026-10-28T14:00:00Z') },
    ]);
  });

  it('horário em comum: só onde todos estão livres', () => {
    const ana = [{ start: at('2026-10-28T11:00:00Z'), end: at('2026-10-28T13:00:00Z') }];
    const bruno = [{ start: at('2026-10-28T14:00:00Z'), end: at('2026-10-28T20:00:00Z') }];
    const slots = commonFree([ana, bruno], ['2026-10-28'], tz, '08:00', '17:00', 60);
    expect(slots.map((s) => [s.start.toISOString(), s.end.toISOString()])).toEqual([
      ['2026-10-28T13:00:00.000Z', '2026-10-28T14:00:00.000Z'],
    ]);
    const options = startOptions(freeSlots([], ['2026-10-28'], tz, '08:00', '10:00'), 60);
    expect(options.map((o) => new Date(o.start).toISOString())).toEqual([
      '2026-10-28T11:00:00.000Z',
      '2026-10-28T11:30:00.000Z',
      '2026-10-28T12:00:00.000Z',
    ]);
  });
});

describe('planejar minha semana', () => {
  it('exemplo do pedido: prova na sexta, revisão de 2 h, quarta livre à noite', () => {
    const today = '2026-10-26'; // segunda
    const revisao = makeTask({
      id: 'rev',
      title: 'Revisão para a prova',
      due_date: '2026-10-30',
      estimated_minutes: 120,
    });
    // Livre: quarta 19h às 22h; quinta só 30 min.
    const slots = [
      {
        day: '2026-10-28',
        start: new Date('2026-10-28T22:00:00Z'),
        end: new Date('2026-10-29T01:00:00Z'),
        minutes: 180,
      },
      {
        day: '2026-10-29',
        start: new Date('2026-10-29T22:00:00Z'),
        end: new Date('2026-10-29T22:30:00Z'),
        minutes: 30,
      },
    ];
    const plan = planWeek({ tasks: [revisao], slots, lastDay: '2026-11-01', today });
    expect(plan.suggestions).toHaveLength(2);
    expect(plan.suggestions.map((s) => [s.start.toISOString(), s.end.toISOString()])).toEqual([
      ['2026-10-28T22:00:00.000Z', '2026-10-28T23:00:00.000Z'],
      ['2026-10-28T23:00:00.000Z', '2026-10-29T00:00:00.000Z'],
    ]);
    expect(plan.suggestions[0].reasons.map((r) => r.key)).toEqual(['deadline', 'free', 'split']);
  });

  it('prazo e prioridade decidem a ordem; não cabe antes do prazo, não sugere', () => {
    const today = '2026-10-26';
    const slots = [
      {
        day: '2026-10-27',
        start: new Date('2026-10-27T22:00:00Z'),
        end: new Date('2026-10-27T23:00:00Z'),
        minutes: 60,
      },
    ];
    const a = makeTask({ id: 'a', due_date: '2026-10-30', priority: 4, estimated_minutes: 60 });
    const b = makeTask({ id: 'b', due_date: '2026-10-28', priority: 1, estimated_minutes: 60 });
    const plan = planWeek({ tasks: [a, b], slots, lastDay: '2026-11-01', today });
    expect(plan.suggestions.map((s) => s.task.id)).toEqual(['b']);
    expect(plan.unplaced.map((t) => t.id)).toEqual(['a']);
    // Já reservado: não sugere de novo.
    expect(
      planWeek({ tasks: [b], slots, lastDay: '2026-11-01', today, reserved: { b: 60 } }).suggestions,
    ).toEqual([]);
    // Sem duração: 30 minutos, avisando.
    const c = makeTask({ id: 'c', due_date: '2026-10-28' });
    const p = planWeek({ tasks: [c], slots, lastDay: '2026-11-01', today });
    expect(p.suggestions[0].end.getTime() - p.suggestions[0].start.getTime()).toBe(30 * 60_000);
    expect(p.assumedDuration).toEqual(['c']);
    // Desmarcada pela pessoa e concluída ficam de fora.
    expect(
      planWeek({
        tasks: [c, makeTask({ id: 'd', status: 'done', due_date: '2026-10-28' })],
        slots,
        lastDay: '2026-11-01',
        today,
        excluded: ['c'],
      }).suggestions,
    ).toEqual([]);
  });

  it('divide tarefas longas em blocos de até 1 hora', () => {
    expect(chunks(30)).toEqual([30]);
    expect(chunks(90)).toEqual([90]);
    expect(chunks(120)).toEqual([60, 60]);
    expect(chunks(130)).toEqual([60, 55, 15]);
  });
});

describe('grade de horários', () => {
  it('posiciona e coloca lado a lado o que é ao mesmo tempo', () => {
    const boxes = layoutDay(
      [
        { key: 'a', start: new Date('2026-10-28T12:00:00Z'), end: new Date('2026-10-28T13:00:00Z') },
        { key: 'b', start: new Date('2026-10-28T12:30:00Z'), end: new Date('2026-10-28T13:30:00Z') },
        { key: 'c', start: new Date('2026-10-28T15:00:00Z'), end: new Date('2026-10-28T15:10:00Z') },
      ],
      '2026-10-28',
      tz,
    );
    const by = Object.fromEntries(boxes.map((b) => [b.key, b]));
    expect(by.a).toMatchObject({ top: 540, height: 60, lane: 0, lanes: 2 });
    expect(by.b).toMatchObject({ top: 570, lane: 1, lanes: 2 });
    expect(by.c).toMatchObject({ top: 720, height: 20, lane: 0, lanes: 1 });
  });

  it('evento que atravessa a meia-noite aparece nos dois dias', () => {
    const item = [
      { key: 'x', start: new Date('2026-10-29T01:00:00Z'), end: new Date('2026-10-29T05:00:00Z') },
    ];
    expect(layoutDay(item, '2026-10-28', tz)[0]).toMatchObject({ top: 1320, continuesAfter: true });
    expect(layoutDay(item, '2026-10-29', tz)[0]).toMatchObject({
      top: 0,
      height: 120,
      continuesBefore: true,
    });
    expect(minutesIntoDay(new Date('2026-10-28T13:30:00Z'), '2026-10-28', tz)).toBe(630);
    expect(minutesIntoDay(new Date('2026-10-30T13:30:00Z'), '2026-10-28', tz)).toBeNull();
  });
});

describe('"O que você pretende fazer hoje?"', () => {
  const habit = (overrides: Partial<Habit> = {}): Habit => ({
    id: 'h1',
    calendar_id: null,
    title: 'Ler 20 minutos',
    description: null,
    color: null,
    recurrence_rule: 'FREQ=DAILY',
    start_date: '2026-10-01',
    status: 'active',
    show_streak: true,
    created_by: 'user-a',
    version: 1,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    logs: [],
    ...overrides,
  });

  it('pergunta só na primeira abertura do dia', () => {
    expect(shouldAskToday({ enabled: true, today: '2026-10-23', checkins: [], dismissedOn: null })).toBe(
      true,
    );
    expect(
      shouldAskToday({ enabled: true, today: '2026-10-23', checkins: ['2026-10-23'], dismissedOn: null }),
    ).toBe(false);
    expect(
      shouldAskToday({ enabled: true, today: '2026-10-23', checkins: [], dismissedOn: '2026-10-23' }),
    ).toBe(false);
    expect(shouldAskToday({ enabled: false, today: '2026-10-23', checkins: [], dismissedOn: null })).toBe(
      false,
    );
  });

  it('hábitos: dias da regra e sequência', () => {
    const sundays = habit({ recurrence_rule: 'FREQ=WEEKLY;BYDAY=SU' });
    expect(habitDueOn(sundays, '2026-10-25')).toBe(true);
    expect(habitDueOn(sundays, '2026-10-23')).toBe(false);
    expect(habitDueOn(habit({ status: 'paused' }), '2026-10-23')).toBe(false);
    const daily = habit({
      logs: [
        { user_id: 'user-a', day: '2026-10-22' },
        { user_id: 'user-a', day: '2026-10-21' },
        { user_id: 'user-b', day: '2026-10-20' },
      ],
    });
    expect(habitStreak(daily, '2026-10-23', 'user-a')).toBe(2);
  });

  it('sugere hábitos do dia, repetições próximas e o que costuma fazer', () => {
    const today = '2026-10-23'; // sexta
    const tasks = [
      makeTask({ id: 'r', title: 'Regar plantas', recurrence_rule: 'FREQ=WEEKLY', due_date: '2026-10-25' }),
      makeTask({ id: 'p', title: 'Planejada', plan_day: today }),
      makeTask({ id: 'f1', title: 'Feira', status: 'done', completed_at: '2026-10-16T14:00:00Z' }),
      makeTask({ id: 'i', title: 'Renovar passaporte', priority: 3 }),
    ];
    const s = suggestForToday({ tasks, habits: [habit()], today, timezone: tz, userId: 'user-a' });
    expect(s.map((x) => [x.kind, x.title, x.reason.key])).toEqual([
      ['habit', 'Ler 20 minutos', 'habit'],
      ['task', 'Regar plantas', 'recurring'],
      ['title', 'Feira', 'weekday'],
      ['task', 'Renovar passaporte', 'important'],
    ]);
  });
});

describe('resumo da semana', () => {
  it('conta compromissos, prazos, atrasadas e sugere com linguagem neutra', () => {
    const summary = summarizeWeek({
      occurrences: expandEvent(
        makeEvent(),
        new Date('2026-11-08T00:00:00Z'),
        new Date('2026-11-15T00:00:00Z'),
      ),
      tasks: [makeTask({ id: 'a', due_date: '2026-11-12' }), makeTask({ id: 'b', due_date: '2026-11-01' })],
      calendars: {},
      days: [
        '2026-11-08',
        '2026-11-09',
        '2026-11-10',
        '2026-11-11',
        '2026-11-12',
        '2026-11-13',
        '2026-11-14',
      ],
      today: '2026-11-09',
      slots: [],
      now: new Date('2026-11-09T12:00:00Z'),
    });
    expect(summary.events).toHaveLength(1);
    expect(summary.deadlines.map((t) => t.id)).toEqual(['a']);
    expect(summary.overdue.map((t) => t.id)).toEqual(['b']);
    expect(summary.suggestions.map((s) => s.key)).toEqual(['plan', 'overdue']);
  });
});
