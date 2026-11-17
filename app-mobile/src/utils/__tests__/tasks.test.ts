import {
  activeTaskFilterCount,
  alertBase,
  badgeCount,
  checklistProgress,
  DEFAULT_TASK_FILTERS,
  describeDue,
  inView,
  isOverdue,
  matchesFilters,
  positionBetween,
  priorityMarks,
  sortTasks,
  tagsInUse,
  viewCounts,
  type ViewContext,
} from '../tasks';

import { makeTask } from './fixtures';

const today = '2026-10-23'; // sexta-feira
const ctx: ViewContext = {
  today,
  now: new Date('2026-10-23T15:00:00Z'), // 12:00 em São Paulo
  userId: 'user-a',
  weekStartsOn: 0,
};

describe('prazos e atraso', () => {
  it('atrasada: dia anterior, ou hoje com horário já passado', () => {
    expect(isOverdue(makeTask({ due_date: '2026-10-22' }), today, ctx.now)).toBe(true);
    expect(isOverdue(makeTask({ due_date: today }), today, ctx.now)).toBe(false);
    expect(isOverdue(makeTask({ due_date: today, due_time: '10:00:00' }), today, ctx.now)).toBe(true);
    expect(isOverdue(makeTask({ due_date: today, due_time: '18:00' }), today, ctx.now)).toBe(false);
    expect(isOverdue(makeTask({ due_date: '2026-10-01', status: 'done' }), today, ctx.now)).toBe(false);
    expect(isOverdue(makeTask({ due_date: null }), today, ctx.now)).toBe(false);
  });

  it('base dos avisos: horário do prazo ou 9h do dia', () => {
    expect(alertBase(makeTask({ due_date: '2026-11-10', due_time: '19:00' }))?.toISOString()).toBe(
      '2026-11-10T22:00:00.000Z',
    );
    expect(alertBase(makeTask({ due_date: '2026-11-10' }))?.toISOString()).toBe('2026-11-10T12:00:00.000Z');
    expect(alertBase(makeTask())).toBeNull();
  });

  it('texto do prazo', () => {
    expect(describeDue(makeTask({ due_date: today }), today)).toBe('Hoje');
    expect(describeDue(makeTask({ due_date: '2026-10-24', due_time: '19:30:00' }), today)).toBe(
      'Amanhã, 19:30',
    );
    expect(describeDue(makeTask({ due_date: '2026-10-27' }), today)).toBe('Ter');
    expect(describeDue(makeTask({ due_date: '2026-10-20' }), today)).toBe('Atrasada há 3 dias');
    expect(describeDue(makeTask({ due_date: '2026-10-22' }), today)).toBe('Ontem');
    expect(describeDue(makeTask({ due_date: '2026-10-20', status: 'done' }), today)).toBe('20 out');
    expect(describeDue(makeTask(), today)).toBeNull();
  });

  it('prioridade não depende só de cor', () => {
    expect(priorityMarks(4)).toBe('!!!');
    expect(priorityMarks(3)).toBe('!!');
    expect(priorityMarks(2)).toBe('!');
    expect(priorityMarks(0)).toBe('');
  });

  it('progresso das etapas', () => {
    const t = makeTask({
      checklist: [
        { id: 'a', title: 'A', done: true, done_at: null, done_by: null, position: 1 },
        { id: 'b', title: 'B', done: false, done_at: null, done_by: null, position: 2 },
      ],
    });
    expect(checklistProgress(t)).toEqual({ done: 1, total: 2 });
  });
});

describe('visões inteligentes', () => {
  const tasks = [
    makeTask({ id: 'inbox' }),
    makeTask({ id: 'listed', list_id: 'l1', due_date: today }),
    makeTask({ id: 'late', due_date: '2026-10-20', priority: 3 }),
    makeTask({ id: 'soon', due_date: '2026-10-28' }),
    makeTask({ id: 'far', due_date: '2026-12-01' }),
    makeTask({ id: 'planned', plan_day: today, list_id: 'l1' }),
    makeTask({ id: 'mine', assignee_id: 'user-a', calendar_id: 'cal-1', list_id: 'l2' }),
    makeTask({ id: 'rem', item_type: 'reminder', due_date: '2026-10-24', due_time: '09:00' }),
    makeTask({ id: 'done', status: 'done', due_date: today }),
  ];
  const ids = (view: Parameters<typeof inView>[1]) =>
    tasks.filter((t) => inView(t, view, ctx)).map((t) => t.id);

  it('cada visão mostra o que deve', () => {
    expect(ids('inbox')).toEqual(['inbox', 'late', 'soon', 'far']);
    expect(ids('today')).toEqual(['listed', 'late', 'planned']);
    expect(ids('upcoming')).toEqual(['soon', 'rem']);
    expect(ids('week')).toEqual(['listed', 'late', 'rem']);
    expect(ids('overdue')).toEqual(['late']);
    expect(ids('nodate')).toEqual(['inbox', 'planned', 'mine']);
    expect(ids('important')).toEqual(['late']);
    expect(ids('assigned')).toEqual(['mine']);
    expect(ids('shared')).toEqual(['mine']);
    expect(ids('reminders')).toEqual(['rem']);
    expect(ids('done')).toEqual(['done']);
    expect(ids('list:l1')).toEqual(['listed', 'planned']);
  });

  it('contadores por visão', () => {
    const counts = viewCounts(tasks, ctx);
    expect(counts.today).toBe(3);
    expect(counts.overdue).toBe(1);
    expect(counts.done).toBe(0);
  });
});

describe('filtros e ordenação', () => {
  const a = makeTask({
    id: 'a',
    title: 'Banana',
    priority: 1,
    due_date: '2026-10-25',
    tags: ['casa'],
    position: 3,
  });
  const b = makeTask({
    id: 'b',
    title: 'abacaxi',
    priority: 4,
    due_date: '2026-10-24',
    due_time: '08:00',
    position: 1,
  });
  const c = makeTask({
    id: 'c',
    title: 'Cenoura',
    priority: 4,
    position: 2,
    recurrence_rule: 'FREQ=DAILY',
    due_date: '2026-10-24',
  });

  it('combina filtros', () => {
    const f = { ...DEFAULT_TASK_FILTERS, priorities: [4 as const] };
    expect([a, b, c].filter((t) => matchesFilters(t, f, ctx)).map((t) => t.id)).toEqual(['b', 'c']);
    expect(activeTaskFilterCount(f)).toBe(1);
    const tag = { ...DEFAULT_TASK_FILTERS, tags: ['casa'] };
    expect([a, b, c].filter((t) => matchesFilters(t, tag, ctx)).map((t) => t.id)).toEqual(['a']);
    const rec = { ...DEFAULT_TASK_FILTERS, recurring: true };
    expect([a, b, c].filter((t) => matchesFilters(t, rec, ctx)).map((t) => t.id)).toEqual(['c']);
    const q = { ...DEFAULT_TASK_FILTERS, query: 'CENOURA' };
    expect([a, b, c].filter((t) => matchesFilters(t, q, ctx)).map((t) => t.id)).toEqual(['c']);
  });

  it('ordena por prazo, prioridade, título e manual', () => {
    expect(sortTasks([a, b, c], 'due').map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(sortTasks([a, b, c], 'priority').map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(sortTasks([a, b, c], 'title').map((t) => t.id)).toEqual(['b', 'a', 'c']);
    expect(sortTasks([a, b, c], 'manual').map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('posição entre vizinhos e etiquetas em uso', () => {
    expect(positionBetween(1, 2)).toBe(1.5);
    expect(positionBetween(null, 2)).toBe(1);
    expect(positionBetween(5, null)).toBe(6);
    expect(tagsInUse([a, makeTask({ tags: ['casa', 'mercado'] })])).toEqual(['casa', 'mercado']);
  });
});

describe('número no ícone', () => {
  it('conta abertas com prazo até hoje, atrasadas, lembretes e planejadas para hoje', () => {
    const tasks = [
      makeTask({ id: 'a', due_date: today }),
      makeTask({ id: 'b', due_date: '2026-10-20' }),
      makeTask({ id: 'c', item_type: 'reminder', due_date: today }),
      makeTask({ id: 'd', due_date: '2026-10-30', plan_day: today }),
      makeTask({ id: 'e', due_date: '2026-10-24' }),
      makeTask({ id: 'f' }),
      makeTask({ id: 'g', due_date: today, status: 'done' }),
      makeTask({ id: 'h', due_date: today, status: 'cancelled' }),
    ];
    expect(badgeCount(tasks, today)).toBe(4);
  });
  it('sem pendências o número some', () => {
    expect(badgeCount([], today)).toBe(0);
  });
});
