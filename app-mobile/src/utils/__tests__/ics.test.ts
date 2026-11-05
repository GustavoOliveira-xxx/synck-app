import { parseIcs, toIcs } from '../ics';

import { makeEvent } from './fixtures';

const TZ = 'America/Sao_Paulo';

describe('toIcs', () => {
  it('gera um VCALENDAR com eventos com hora e de dia inteiro', () => {
    const text = toIcs(
      [
        makeEvent({
          id: 'a',
          title: 'Reunião, com vírgula',
          starts_at: '2026-10-26T12:00:00.000Z',
          ends_at: '2026-10-26T13:00:00.000Z',
          timezone: TZ,
        }),
        makeEvent({
          id: 'b',
          title: 'Feriado',
          all_day: true,
          start_date: '2026-11-02',
          end_date: '2026-11-02',
          starts_at: '2026-11-02T03:00:00.000Z',
          ends_at: '2026-11-03T03:00:00.000Z',
          timezone: TZ,
        }),
        makeEvent({ id: 'c', title: null, is_masked: true }),
      ],
      'Família',
      new Date('2026-10-24T10:00:00Z'),
    );
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('X-WR-CALNAME:Família');
    expect(text).toContain('DTSTART;TZID=America/Sao_Paulo:20261026T090000');
    expect(text).toContain('SUMMARY:Reunião\\, com vírgula');
    expect(text).toContain('DTSTART;VALUE=DATE:20261102');
    expect(text).toContain('DTEND;VALUE=DATE:20261103');
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('exporta repetição com UNTIL em UTC e ocorrências canceladas como EXDATE', () => {
    const text = toIcs(
      [
        makeEvent({
          id: 'r',
          starts_at: '2026-10-26T12:00:00.000Z',
          ends_at: '2026-10-26T13:00:00.000Z',
          timezone: TZ,
          recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO;UNTIL=20261130',
          exceptions: [
            {
              original_date: '2026-11-02',
              is_cancelled: true,
              title: null,
              description: null,
              location: null,
              starts_at: null,
              ends_at: null,
            },
          ],
        }),
      ],
      'X',
    );
    expect(text).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261201T025959Z');
    expect(text).toContain('EXDATE;TZID=America/Sao_Paulo:20261102T090000');
  });

  it('quebra linhas longas em até 75 caracteres', () => {
    const text = toIcs([makeEvent({ description: 'a'.repeat(300) })], 'X');
    for (const line of text.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe('parseIcs', () => {
  it('lê o que o próprio SynCK exporta', () => {
    const exported = toIcs(
      [
        makeEvent({
          id: 'a',
          title: 'Dentista; retorno',
          description: 'Levar exames\nem jejum',
          starts_at: '2026-10-26T12:00:00.000Z',
          ends_at: '2026-10-26T13:30:00.000Z',
          timezone: TZ,
          recurrence_rule: 'FREQ=MONTHLY;BYMONTHDAY=26;COUNT=3',
        }),
      ],
      'X',
    );
    const [e] = parseIcs(exported, TZ);
    expect(e).toMatchObject({
      uid: 'a@synck',
      title: 'Dentista; retorno',
      description: 'Levar exames\nem jejum',
      allDay: false,
      startDate: '2026-10-26',
      startTime: '09:00',
      endTime: '10:30',
      simplified: false,
    });
    expect(e.recurrence).toMatchObject({ freq: 'MONTHLY', byMonthDay: 26, count: 3 });
  });

  it('converte horários em UTC e de outros fusos para o fuso escolhido', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:x1',
      'DTSTART:20261026T150000Z',
      'DURATION:PT45M',
      'SUMMARY:Chamada',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:x2',
      'DTSTART;TZID="Europe/Lisbon":20261027T100000',
      'DTEND;TZID="Europe/Lisbon":20261027T110000',
      'SUMMARY:Lisboa',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const [a, b] = parseIcs(ics, TZ);
    expect(a).toMatchObject({ startTime: '12:00', endTime: '12:45' });
    expect(b).toMatchObject({ startDate: '2026-10-27', startTime: '07:00', endTime: '08:00' });
  });

  it('trata o fim exclusivo dos eventos de dia inteiro e linhas dobradas', () => {
    const ics = [
      'BEGIN:VEVENT',
      'UID:d1',
      'DTSTART;VALUE=DATE:20261224',
      'DTEND;VALUE=DATE:20261226',
      'SUMMARY:Natal com a fam',
      ' ília',
      'END:VEVENT',
    ].join('\r\n');
    const [e] = parseIcs(ics, TZ);
    expect(e).toMatchObject({
      allDay: true,
      startDate: '2026-12-24',
      endDate: '2026-12-25',
      title: 'Natal com a família',
    });
  });

  it('simplifica repetições não suportadas, ignora alarmes e ocorrências alteradas', () => {
    const ics = [
      'BEGIN:VEVENT',
      'UID:r1',
      'DTSTART:20261026T120000Z',
      'DTEND:20261026T130000Z',
      'RRULE:FREQ=MONTHLY;BYDAY=2TU',
      'SUMMARY:Segunda terça',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'SUMMARY:alarme',
      'END:VALARM',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:r1',
      'RECURRENCE-ID:20261110T120000Z',
      'DTSTART:20261110T140000Z',
      'SUMMARY:Alterada',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:w1',
      'DTSTART;VALUE=DATE:20261101',
      'RRULE:FREQ=WEEKLY;WKST=MO;BYDAY=SU;UNTIL=20261231T000000Z',
      'SUMMARY:Feira',
      'END:VEVENT',
    ].join('\n');
    const events = parseIcs(ics, TZ);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ title: 'Segunda terça', simplified: true, recurrence: null });
    expect(events[1].recurrence).toMatchObject({ freq: 'WEEKLY', byDay: ['SU'], until: '2026-12-31' });
    expect(events[1].endDate).toBe('2026-11-01');
  });

  it('mantém EXDATE e liga uma remarcação anterior à série pelo UID', () => {
    const text = [
      'BEGIN:VEVENT',
      'UID:m',
      'RECURRENCE-ID:20261109T120000Z',
      'DTSTART:20261110T120000Z',
      'DTEND:20261110T130000Z',
      'SUMMARY:Remarcada',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:m',
      'DTSTART:20261102T120000Z',
      'RRULE:FREQ=WEEKLY',
      'EXDATE:20261116T120000Z',
      'SUMMARY:Equipe',
      'END:VEVENT',
    ].join('\n');
    const [meeting] = parseIcs(text, 'UTC');
    expect(meeting.exceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ original_date: '2026-11-09', title: 'Remarcada' }),
        expect.objectContaining({ original_date: '2026-11-16', is_cancelled: true }),
      ]),
    );
  });
  it('ignora eventos sem início e texto que não é .ics', () => {
    expect(parseIcs('BEGIN:VEVENT\nSUMMARY:x\nEND:VEVENT', TZ)).toEqual([]);
    expect(parseIcs('qualquer coisa', TZ)).toEqual([]);
  });
});
