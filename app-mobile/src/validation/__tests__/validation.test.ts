import { localToInstant } from '@/utils/dates';
import { parseRule } from '@/utils/recurrence';

import { validateLogin, validateSignup } from '../auth';
import { validateCalendar } from '../calendar';
import {
  changedFields,
  eventToForm,
  formToFields,
  newEventForm,
  validateEventForm,
  withDuration,
  withStart,
  type EventForm,
} from '../event';
import { formatInviteCode, normalizeInviteCode, validateInviteCode } from '../invite';
import { makeEvent } from '../../utils/__tests__/fixtures';

const baseForm = (overrides: Partial<EventForm> = {}): EventForm => ({
  ...newEventForm('cal-1', 'America/Sao_Paulo', '2026-11-10', new Date('2026-11-01T12:00:00Z')),
  title: 'Jantar',
  ...overrides,
});

describe('validação de cadastro e login', () => {
  it('exige nome, e-mail válido, senha forte e confirmação igual', () => {
    expect(validateSignup({ name: '', email: 'x', password: '123', confirm: '1' })).toEqual({
      name: 'Campo obrigatório.',
      email: 'E-mail inválido.',
      password: 'A senha precisa ter pelo menos 8 caracteres.',
      confirm: 'As senhas não são iguais.',
    });
    expect(
      validateSignup({
        name: 'Ana',
        email: 'ana@exemplo.test',
        password: 'senhasemnumero',
        confirm: 'senhasemnumero',
      }).password,
    ).toBe('Use letras e números na senha.');
    expect(
      validateSignup({ name: 'Ana', email: 'ana@exemplo.test', password: 'Senha123', confirm: 'Senha123' }),
    ).toEqual({});
    expect(validateLogin({ email: 'ana@exemplo.test', password: '' })).toEqual({
      password: 'Campo obrigatório.',
    });
  });
});

describe('validação de agenda', () => {
  it('nome obrigatório, limites e cor', () => {
    expect(validateCalendar({ name: ' ', description: '', color: '#123456' })).toEqual({
      name: 'Campo obrigatório.',
    });
    expect(validateCalendar({ name: 'Casa', description: 'x'.repeat(501), color: 'azul' })).toEqual({
      description: 'Máximo de 500 caracteres.',
      color: 'Cor inválida.',
    });
  });
});

describe('validação de evento', () => {
  it('formulário novo começa na próxima hora cheia, com 1 hora de duração', () => {
    const f = newEventForm('cal-1', 'America/Sao_Paulo', '2026-11-01', new Date('2026-11-01T12:20:00Z'));
    expect([f.startDate, f.startTime, f.endDate, f.endTime]).toEqual([
      '2026-11-01',
      '10:00',
      '2026-11-01',
      '11:00',
    ]);
    const late = newEventForm('cal-1', 'America/Sao_Paulo', '2026-11-01', new Date('2026-11-02T02:30:00Z'));
    // 23h30: a próxima hora cheia seria no dia seguinte; sugere 9h do dia seguinte.
    expect([late.startDate, late.startTime]).toEqual(['2026-11-02', '09:00']);
    expect([late.endDate, late.endTime]).toEqual(['2026-11-02', '10:00']);
    const evening = newEventForm(
      'cal-1',
      'America/Sao_Paulo',
      '2026-11-01',
      new Date('2026-11-02T01:30:00Z'),
    );
    expect([evening.startTime, evening.endDate, evening.endTime]).toEqual(['23:00', '2026-11-02', '00:00']);
  });

  it('título obrigatório, término depois do início, URL e textos', () => {
    expect(validateEventForm(baseForm({ title: '  ' })).title).toBe('Campo obrigatório.');
    expect(validateEventForm(baseForm({ endTime: '08:00', startTime: '09:00' })).end).toBe(
      'O término precisa ser depois do início.',
    );
    expect(validateEventForm(baseForm({ url: 'javascript:alert(1)' })).url).toBe(
      'Link inválido. Comece com https://',
    );
    expect(validateEventForm(baseForm({ url: 'https://meet.exemplo.test/abc' })).url).toBeUndefined();
    expect(validateEventForm(baseForm({ location: 'x'.repeat(201) })).location).toBe(
      'Máximo de 200 caracteres.',
    );
    expect(validateEventForm(baseForm({ startDate: '2026-02-30' })).start).toBe('Data inválida.');
    expect(validateEventForm(baseForm())).toEqual({});
  });

  it('dia inteiro aceita início e fim no mesmo dia', () => {
    expect(validateEventForm(baseForm({ allDay: true, endDate: '2026-11-10' }))).toEqual({});
    expect(validateEventForm(baseForm({ allDay: true, endDate: '2026-11-09' })).end).toBeDefined();
  });

  it('recorrência consistente e limite de lembretes', () => {
    expect(
      validateEventForm(baseForm({ recurrence: { ...parseRule('FREQ=DAILY')!, until: '2026-11-01' } }))
        .recurrence,
    ).toBe('A data final da repetição precisa ser depois do início.');
    expect(
      validateEventForm(baseForm({ recurrence: { ...parseRule('FREQ=WEEKLY')!, byDay: [] } })).recurrence,
    ).toBe('Escolha pelo menos um dia da semana.');
    expect(validateEventForm(baseForm({ reminders: [1, 2, 3, 4, 5, 6] })).reminders).toBe(
      'No máximo 5 lembretes.',
    );
    expect(validateEventForm(baseForm({ reminders: [50000] })).reminders).toBeDefined();
  });

  it('converte o formulário para o formato do servidor (UTC + fuso + datas locais)', () => {
    const fields = formToFields(
      baseForm({ startTime: '20:00', endTime: '21:30', recurrence: parseRule('FREQ=WEEKLY;BYDAY=TU') }),
    );
    expect(fields.starts_at).toBe('2026-11-10T23:00:00.000Z');
    expect(fields.ends_at).toBe('2026-11-11T00:30:00.000Z');
    expect(fields.recurrence_rule).toBe('FREQ=WEEKLY;BYDAY=TU');
    expect(fields.start_date).toBeNull();
    const allDay = formToFields(baseForm({ allDay: true, startDate: '2026-12-24', endDate: '2026-12-25' }));
    expect([allDay.start_date, allDay.end_date, allDay.starts_at]).toEqual([
      '2026-12-24',
      '2026-12-25',
      '2026-12-24T03:00:00.000Z',
    ]);
  });

  it('ida e volta evento -> formulário -> campos preserva os dados', () => {
    const ev = makeEvent({
      starts_at: localToInstant('2026-11-10', '19:00', 'America/Sao_Paulo').toISOString(),
      ends_at: localToInstant('2026-11-10', '20:00', 'America/Sao_Paulo').toISOString(),
      location: 'Casa',
    });
    const form = eventToForm(ev);
    expect([form.startTime, form.endTime, form.location]).toEqual(['19:00', '20:00', 'Casa']);
    const fields = formToFields(form);
    expect(changedFields(ev, fields)).toEqual({});
    expect(changedFields(ev, { ...fields, location: 'Restaurante' })).toEqual({ location: 'Restaurante' });
  });
});

describe('código de convite', () => {
  it('normaliza igual ao servidor (O vira 0, I e L viram 1, sem traços)', () => {
    expect(normalizeInviteCode('abcd-efgh-o1il')).toBe('ABCDEFGH0111');
    expect(formatInviteCode('abcdefgh0111')).toBe('ABCD-EFGH-0111');
    expect(validateInviteCode('ABCD-EFGH-0111')).toBeUndefined();
    expect(validateInviteCode('ABCD-EFGH-011')).toBeDefined();
    expect(validateInviteCode('ABCD-EFGH-011U')).toBeDefined();
  });
});

describe('duração do evento no formulário', () => {
  it('1 h começando 23:30 termina 00:30 do dia seguinte (e é válido)', () => {
    const form = withDuration(baseForm({ startDate: '2026-11-10', startTime: '23:30' }), 60);
    expect(form.endDate).toBe('2026-11-11');
    expect(form.endTime).toBe('00:30');
    expect(validateEventForm(form)).toEqual({});
  });

  it('mudar o início leva o término junto', () => {
    const form = baseForm({ startTime: '09:00', endDate: '2026-11-10', endTime: '10:30' });
    const moved = withStart(form, '2026-11-12', '14:00');
    expect([moved.endDate, moved.endTime]).toEqual(['2026-11-12', '15:30']);
  });

  it('término antes do início vira 1 h ao mudar o início', () => {
    const form = baseForm({ startTime: '10:00', endDate: '2026-11-10', endTime: '09:00' });
    expect(withStart(form, '2026-11-10', '11:00').endTime).toBe('12:00');
  });
});
