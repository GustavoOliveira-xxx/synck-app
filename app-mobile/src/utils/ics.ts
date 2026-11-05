// Arquivos .ics (RFC 5545): exportar uma agenda e importar eventos de outros
// aplicativos. Cobre o que o SynCK representa: eventos com horário ou de dia
// inteiro, regras de repetição simples e exclusões de ocorrências.
import { DateTime } from 'luxon';

import type { CalendarEvent, DateKey, RecurrenceException } from '@/models/types';

import { addDaysToKey, instantToLocal, isValidTimezone } from './dates';
import { parseRule, serializeRule, type RecurrenceRule } from './recurrence';

const PRODID = '-//SynCK//Agenda//PT-BR';

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function unescapeText(value: string): string {
  return value.replace(/\\(n|N|,|;|\\)/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

/** Quebra linhas longas em 75 octetos, como pede a RFC (continuação começa com espaço). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

const compactDate = (key: DateKey) => key.replace(/-/g, '');

function utcStamp(date: Date): string {
  return DateTime.fromJSDate(date).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
}

function localStamp(date: Date, tz: string): string {
  return DateTime.fromJSDate(date).setZone(tz).toFormat("yyyyMMdd'T'HHmmss");
}

function ruleForExport(rule: string, allDay: boolean, tz: string): string {
  const parsed = parseRule(rule);
  if (!parsed) return rule;
  if (!parsed.until || allDay) return serializeRule(parsed);
  // Com hora marcada, UNTIL precisa ser data e hora em UTC: fim do último dia.
  const until = DateTime.fromISO(`${parsed.until}T23:59:59`, { zone: tz })
    .toUTC()
    .toFormat("yyyyMMdd'T'HHmmss'Z'");
  return serializeRule({ ...parsed, until: null }).concat(`;UNTIL=${until}`);
}

/** Gera o conteúdo .ics de uma lista de eventos. Eventos mascarados ficam de fora. */
export function toIcs(events: CalendarEvent[], calendarName: string, now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];
  const stamp = utcStamp(now);
  const block = (e: CalendarEvent, uid: string, extra: string[]) => {
    const start = new Date(e.starts_at);
    const end = new Date(e.ends_at);
    const title = e.title ?? '';
    lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`);
    if (e.all_day && e.start_date && e.end_date) {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(e.start_date)}`);
      lines.push(`DTEND;VALUE=DATE:${compactDate(addDaysToKey(e.end_date, 1))}`);
    } else if (isValidTimezone(e.timezone) && e.timezone !== 'UTC') {
      lines.push(`DTSTART;TZID=${e.timezone}:${localStamp(start, e.timezone)}`);
      lines.push(`DTEND;TZID=${e.timezone}:${localStamp(end, e.timezone)}`);
    } else {
      lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
    }
    lines.push(`SUMMARY:${escapeText(title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    const where = [e.location, e.address].filter(Boolean).join(', ');
    if (where) lines.push(`LOCATION:${escapeText(where)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    if (e.status === 'cancelled') lines.push('STATUS:CANCELLED');
    else if (e.status === 'planned') lines.push('STATUS:TENTATIVE');
    lines.push(...extra, 'END:VEVENT');
  };

  for (const e of events) {
    if (e.is_masked || e.deleted_at) continue;
    const uid = e.external_uid ?? `${e.id}@synck`;
    const extra: string[] = [];
    if (e.recurrence_rule) {
      extra.push(`RRULE:${ruleForExport(e.recurrence_rule, e.all_day, e.timezone)}`);
      for (const x of e.exceptions) {
        if (!x.is_cancelled) continue;
        if (e.all_day) extra.push(`EXDATE;VALUE=DATE:${compactDate(x.original_date)}`);
        else {
          const local = instantToLocal(new Date(e.starts_at), e.timezone);
          const original = DateTime.fromISO(`${x.original_date}T${local.time}`, { zone: e.timezone });
          extra.push(`EXDATE;TZID=${e.timezone}:${original.toFormat("yyyyMMdd'T'HHmmss")}`);
        }
      }
    }
    block(e, uid, extra);
    for (const x of e.exceptions) {
      if (x.is_cancelled) continue;
      const tz = e.timezone,
        local = instantToLocal(new Date(e.starts_at), tz);
      const original = DateTime.fromISO(x.original_date + 'T' + local.time, { zone: tz });
      const recId = e.all_day
        ? 'RECURRENCE-ID;VALUE=DATE:' + compactDate(x.original_date)
        : 'RECURRENCE-ID:' + utcStamp(original.toJSDate());
      const at = x.starts_at ?? original.toUTC().toISO()!;
      const until =
        x.ends_at ?? new Date(Date.parse(at) + Date.parse(e.ends_at) - Date.parse(e.starts_at)).toISOString();
      const props = [recId];
      if (x.status) props.push('X-SYNCK-STATUS:' + x.status);
      const durationDays =
        e.all_day && e.start_date && e.end_date
          ? Math.round(
              DateTime.fromISO(e.end_date, { zone: 'UTC' }).diff(
                DateTime.fromISO(e.start_date, { zone: 'UTC' }),
                'days',
              ).days,
            )
          : 0;
      block(
        {
          ...e,
          title: x.title ?? e.title,
          description: x.description ?? e.description,
          location: x.location ?? e.location,
          starts_at: at,
          ends_at: until,
          start_date: x.original_date,
          end_date: addDaysToKey(x.original_date, durationDays),
          all_day: e.all_day && !x.starts_at,
        },
        uid,
        props,
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------

export interface ImportedEvent {
  uid: string;
  title: string;
  description: string;
  location: string;
  url: string;
  allDay: boolean;
  timezone: string;
  startDate: DateKey;
  startTime: string;
  endDate: DateKey;
  endTime: string;
  recurrence: RecurrenceRule | null;
  /** A regra de repetição do arquivo não é suportada: entra como evento único. */
  exceptions: RecurrenceException[];
  simplified: boolean;
  cancelled: boolean;
}

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');
}

function parseLine(line: string): Property | null {
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ':' && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon < 1) return null;
  const [name, ...rawParams] = line.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

interface ParsedTime {
  date: DateKey;
  time: string;
  allDay: boolean;
  instant: DateTime;
}

function parseTime(prop: Property, fallbackTz: string): ParsedTime | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(prop.value.trim());
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}` as DateKey;
  if (!m[4] || prop.params.VALUE === 'DATE') {
    return { date, time: '00:00', allDay: true, instant: DateTime.fromISO(date, { zone: fallbackTz }) };
  }
  const zone = m[7] ? 'UTC' : isValidTimezone(prop.params.TZID) ? prop.params.TZID : fallbackTz;
  const dt = DateTime.fromObject(
    { year: +m[1], month: +m[2], day: +m[3], hour: +m[4], minute: +m[5], second: +(m[6] ?? 0) },
    { zone },
  );
  if (!dt.isValid) return null;
  const local = dt.setZone(fallbackTz);
  return { date: local.toISODate() as DateKey, time: local.toFormat('HH:mm'), allDay: false, instant: dt };
}

function parseDuration(value: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m) return null;
  const minutes =
    (+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 1440 +
    +(m[4] ?? 0) * 60 +
    +(m[5] ?? 0) +
    Math.floor(+(m[6] ?? 0) / 60);
  return m[1] === '-' ? null : minutes;
}

/** Converte a RRULE do arquivo para o subconjunto do SynCK, ou null se não der. */
function importRule(value: string): RecurrenceRule | null {
  const kept: string[] = [];
  for (const part of value.split(';')) {
    const [key, v] = part.split('=');
    if (!v) continue;
    const name = key.toUpperCase();
    if (name === 'WKST') continue;
    if (name === 'UNTIL') kept.push(`UNTIL=${v.slice(0, 8)}`);
    else kept.push(`${name}=${v.toUpperCase()}`);
  }
  return parseRule(kept.join(';'));
}

/** Lê um arquivo .ics e devolve os eventos que o SynCK consegue representar. */
export function parseIcs(text: string, timezone: string): ImportedEvent[] {
  const out: ImportedEvent[] = [];
  const seen = new Set<string>();
  const detached: Property[][] = [];
  let current: Property[] | null = null;
  let depth = 0;
  for (const raw of unfold(text)) {
    const line = raw.trimEnd();
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      current = [];
      depth = 0;
      continue;
    }
    if (!current) continue;
    if (upper.startsWith('BEGIN:')) {
      depth++;
      continue;
    }
    if (upper.startsWith('END:') && upper !== 'END:VEVENT') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (upper === 'END:VEVENT') {
      if (current.some((p) => p.name === 'RECURRENCE-ID')) detached.push(current);
      const event = buildEvent(current, timezone);
      if (event && !seen.has(event.uid)) {
        seen.add(event.uid);
        out.push(event);
      }
      current = null;
      continue;
    }
    if (depth > 0) continue;
    const prop = parseLine(line);
    if (prop) current.push(prop);
  }
  const series = new Map(out.filter((e) => e.recurrence).map((e) => [e.uid, e]));
  for (const props of detached) {
    const get = (name: string) => props.find((p) => p.name === name);
    const parent = series.get(get('UID')?.value.trim() ?? '');
    const origin = get('RECURRENCE-ID');
    if (!parent || !origin) continue;
    const date = parseTime(origin, parent.timezone)?.date;
    if (!date) continue;
    const cancelled = get('STATUS')?.value.toUpperCase() === 'CANCELLED';
    const move = buildEvent(
      props.filter((p) => p !== origin),
      parent.timezone,
    );
    if (!cancelled && !move) continue;
    const when = (day: string, time: string) =>
      DateTime.fromISO(day + 'T' + time, { zone: parent.timezone })
        .toUTC()
        .toISO();
    const sameAllDay = move?.allDay && move.startDate === date && parent.allDay;
    const status = get('X-SYNCK-STATUS')?.value;
    const change: RecurrenceException = {
      original_date: date,
      is_cancelled: cancelled,
      title: move?.title ?? null,
      description: move?.description ?? null,
      location: move?.location ?? null,
      starts_at: move && !sameAllDay ? when(move.startDate, move.allDay ? '00:00' : move.startTime) : null,
      ends_at:
        move && !sameAllDay
          ? when(
              move.allDay ? addDaysToKey(move.endDate, 1) : move.endDate,
              move.allDay ? '00:00' : move.endTime,
            )
          : null,
      status: status === 'completed' || status === 'planned' ? status : null,
    };
    parent.exceptions = parent.exceptions.filter((x) => x.original_date !== date).concat(change);
  }
  return out;
}

function buildEvent(props: Property[], timezone: string): ImportedEvent | null {
  const get = (name: string) => props.find((p) => p.name === name);
  // Ocorrências alteradas de outra série não são importadas como série nova.
  if (get('RECURRENCE-ID')) return null;
  const startProp = get('DTSTART');
  if (!startProp) return null;
  const start = parseTime(startProp, timezone);
  if (!start) return null;
  const endProp = get('DTEND');
  let end = endProp ? parseTime(endProp, timezone) : null;
  if (!end) {
    const duration = get('DURATION');
    const minutes = duration ? parseDuration(duration.value) : null;
    const instant = start.instant.plus({ minutes: minutes ?? (start.allDay ? 1440 : 60) });
    const local = instant.setZone(timezone);
    end = start.allDay
      ? { date: instant.toISODate() as DateKey, time: '00:00', allDay: true, instant }
      : { date: local.toISODate() as DateKey, time: local.toFormat('HH:mm'), allDay: false, instant };
  }
  let endDate = end.date;
  let endTime = end.time;
  if (start.allDay) {
    // No .ics o fim de um evento de dia inteiro é exclusivo.
    endDate = end.date > start.date ? addDaysToKey(end.date, -1) : start.date;
    endTime = '00:00';
  } else if (end.instant <= start.instant) {
    const local = start.instant.plus({ minutes: 30 }).setZone(timezone);
    endDate = local.toISODate() as DateKey;
    endTime = local.toFormat('HH:mm');
  }
  const rruleProp = get('RRULE');
  const recurrence = rruleProp ? importRule(rruleProp.value) : null;
  const summary = get('SUMMARY');
  const title = summary ? unescapeText(summary.value).trim().slice(0, 150) : '';
  const uid = get('UID')?.value.trim() || `${start.instant.toISO()}-${title}`;
  return {
    uid: uid.slice(0, 255),
    exceptions: Array.from(
      new Set(
        props
          .filter((p) => p.name === 'EXDATE')
          .flatMap((p) => p.value.split(',').map((value) => parseTime({ ...p, value }, timezone)?.date))
          .filter((d): d is string => !!d),
      ),
    ).map((original_date) => ({
      original_date,
      is_cancelled: true,
      title: null,
      description: null,
      location: null,
      starts_at: null,
      ends_at: null,
    })),
    title: title || '(sem título)',
    description: unescapeText(get('DESCRIPTION')?.value ?? '').slice(0, 5000),
    location: unescapeText(get('LOCATION')?.value ?? '').slice(0, 200),
    url: /^https?:\/\//i.test(get('URL')?.value ?? '') ? (get('URL')?.value ?? '') : '',
    allDay: start.allDay,
    timezone,
    startDate: start.date,
    startTime: start.allDay ? '09:00' : start.time,
    endDate,
    endTime: start.allDay ? '10:00' : endTime,
    recurrence,
    simplified: !!rruleProp && !recurrence,
    cancelled: get('STATUS')?.value.toUpperCase() === 'CANCELLED',
  };
}
