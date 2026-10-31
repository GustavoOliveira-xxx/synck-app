// Formulário de evento: validação e conversão para o formato do servidor.
import { t } from '@/i18n';
import type {
  CalendarEvent,
  DateKey,
  EventFields,
  EventPrivacy,
  EventStatus,
  EventType,
} from '@/models/types';
import {
  addDaysToKey,
  allDayInstants,
  compareKeys,
  instantToLocal,
  isValidDateKey,
  isValidTimezone,
  localToInstant,
} from '@/utils/dates';
import { parseRule, serializeRule, type RecurrenceRule } from '@/utils/recurrence';

import { clean, type FieldErrors } from './auth';

export interface EventForm {
  calendarId: string;
  title: string;
  allDay: boolean;
  startDate: DateKey;
  startTime: string;
  endDate: DateKey;
  endTime: string;
  timezone: string;
  location: string;
  address: string;
  url: string;
  description: string;
  eventType: EventType;
  status: EventStatus;
  privacy: EventPrivacy;
  color: string | null;
  assigneeId: string | null;
  attendeeIds: string[];
  reminders: number[];
  recurrence: RecurrenceRule | null;
}

export type EventFormField =
  | 'title'
  | 'start'
  | 'end'
  | 'url'
  | 'location'
  | 'address'
  | 'description'
  | 'recurrence'
  | 'reminders'
  | 'timezone';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DURATION_MS = 366 * 86_400_000;

export function isValidUrl(url: string): boolean {
  if (!/^https?:\/\/\S+$/i.test(url) || url.length > 2048) return false;
  try {
    const parsed = new URL(url);
    return !!parsed.hostname && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Instantes de início e fim calculados a partir do formulário. */
export function formInstants(form: EventForm): { start: Date; end: Date } | null {
  if (!isValidDateKey(form.startDate) || !isValidDateKey(form.endDate) || !isValidTimezone(form.timezone)) {
    return null;
  }
  if (form.allDay) {
    const { startsAt, endsAt } = allDayInstants(form.startDate, form.endDate, form.timezone);
    return { start: new Date(startsAt), end: new Date(endsAt) };
  }
  if (!TIME_RE.test(form.startTime) || !TIME_RE.test(form.endTime)) return null;
  return {
    start: localToInstant(form.startDate, form.startTime, form.timezone),
    end: localToInstant(form.endDate, form.endTime, form.timezone),
  };
}

export function validateEventForm(form: EventForm): FieldErrors<EventFormField> {
  const title = form.title.trim();
  const errors: FieldErrors<EventFormField> = {};

  if (!title) errors.title = t('validation.required');
  else if (title.length > 150) errors.title = t('validation.tooLong', { max: 150 });

  if (!isValidTimezone(form.timezone)) errors.timezone = t('errors.invalidTimezone');

  if (!isValidDateKey(form.startDate) || (!form.allDay && !TIME_RE.test(form.startTime))) {
    errors.start = t('validation.invalidDate');
  }
  if (!isValidDateKey(form.endDate) || (!form.allDay && !TIME_RE.test(form.endTime))) {
    errors.end = t('validation.invalidDate');
  }
  const instants = formInstants(form);
  if (instants && !errors.start && !errors.end) {
    if (form.allDay ? compareKeys(form.endDate, form.startDate) < 0 : instants.end <= instants.start) {
      errors.end = t('validation.endBeforeStart');
    } else if (instants.end.getTime() - instants.start.getTime() > MAX_DURATION_MS) {
      errors.end = t('validation.tooLongEvent');
    }
  }

  const url = form.url.trim();
  if (url && !isValidUrl(url)) errors.url = t('validation.invalidUrl');
  if (form.location.trim().length > 200) errors.location = t('validation.tooLong', { max: 200 });
  if (form.address.trim().length > 300) errors.address = t('validation.tooLong', { max: 300 });
  if (form.description.length > 5000) errors.description = t('validation.tooLong', { max: 5000 });

  const rule = form.recurrence;
  if (rule) {
    if (rule.interval < 1 || rule.interval > 99) errors.recurrence = t('validation.intervalRange');
    else if (rule.count !== null && (rule.count < 1 || rule.count > 999))
      errors.recurrence = t('validation.countRange');
    else if (rule.until && compareKeys(rule.until, form.startDate) < 0)
      errors.recurrence = t('validation.untilBeforeStart');
    else if (rule.freq === 'WEEKLY' && rule.byDay.length === 0)
      errors.recurrence = t('validation.weekdaysRequired');
  }

  if (form.reminders.length > 5) errors.reminders = t('validation.tooManyReminders');
  else if (form.reminders.some((m) => !Number.isInteger(m) || m < 0 || m > 40320)) {
    errors.reminders = t('validation.reminderRange');
  }

  return clean(errors);
}

const nullIfEmpty = (value: string) => (value.trim() ? value.trim() : null);

/** Converte o formulário nos campos que o servidor entende. */
export function formToFields(form: EventForm): EventFields {
  const instants = formInstants(form);
  if (!instants) throw new Error('Formulário de evento inválido');
  return {
    title: form.title.trim(),
    description: nullIfEmpty(form.description),
    location: nullIfEmpty(form.location),
    address: nullIfEmpty(form.address),
    url: nullIfEmpty(form.url),
    all_day: form.allDay,
    starts_at: instants.start.toISOString(),
    ends_at: instants.end.toISOString(),
    start_date: form.allDay ? form.startDate : null,
    end_date: form.allDay ? form.endDate : null,
    timezone: form.timezone,
    recurrence_rule: form.recurrence ? serializeRule(form.recurrence) : null,
    assignee_id: form.assigneeId,
    color: form.color,
    event_type: form.eventType,
    status: form.status,
    privacy: form.privacy,
  };
}

/** Formulário inicial de um evento novo: próxima hora cheia, duração de 1 hora. */
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Minutos desde a meia-noite de "HH:MM". */
function minutesOf(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/** Duração do evento em minutos (no relógio local do formulário). */
export function formDuration(
  form: Pick<EventForm, 'startDate' | 'startTime' | 'endDate' | 'endTime'>,
): number {
  const days = Math.round(
    (Date.parse(`${form.endDate}T00:00:00Z`) - Date.parse(`${form.startDate}T00:00:00Z`)) / 86_400_000,
  );
  return days * 1440 + minutesOf(form.endTime) - minutesOf(form.startTime);
}

/**
 * Termina `minutes` depois do início. Passa da meia-noite quando precisa
 * (começar 23:30 com 1 h termina 00:30 do dia seguinte).
 */
export function withDuration<T extends EventForm>(form: T, minutes: number): T {
  const total = minutesOf(form.startTime) + Math.max(0, minutes);
  return {
    ...form,
    endDate: addDaysToKey(form.startDate, Math.floor(total / 1440)),
    endTime: `${pad2(Math.floor((total % 1440) / 60))}:${pad2(total % 60)}`,
  };
}

/** Muda o início e leva o término junto, mantendo a duração. */
export function withStart<T extends EventForm>(form: T, startDate: DateKey, startTime: string): T {
  const length = formDuration(form);
  return withDuration({ ...form, startDate, startTime }, length > 0 ? length : 60);
}

export function newEventForm(
  calendarId: string,
  timezone: string,
  day: DateKey,
  now: Date = new Date(),
  defaultReminder: number | null = null,
): EventForm {
  const local = instantToLocal(now, timezone);
  let hour = Number(local.time.slice(0, 2)) + 1;
  let startDate = day;
  if (day !== local.dateKey) hour = 9;
  if (hour > 23) {
    hour = 9;
    startDate = addDaysToKey(day, 1);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const endHour = hour + 1;
  return {
    calendarId,
    title: '',
    allDay: false,
    startDate,
    startTime: `${pad(hour)}:00`,
    endDate: endHour > 23 ? addDaysToKey(startDate, 1) : startDate,
    endTime: `${pad(endHour % 24)}:00`,
    timezone,
    location: '',
    address: '',
    url: '',
    description: '',
    eventType: 'appointment',
    status: 'confirmed',
    privacy: 'members',
    color: null,
    assigneeId: null,
    attendeeIds: [],
    reminders: defaultReminder === null ? [] : [defaultReminder],
    recurrence: null,
  };
}

/**
 * Formulário preenchido a partir de um evento. Se "occurrence" for informada,
 * usa as datas daquela ocorrência (edição de "só esta" ou "esta e as próximas").
 */
export function eventToForm(
  event: CalendarEvent,
  occurrence?: {
    start: Date;
    end: Date;
    startDate: DateKey | null;
    endDate: DateKey | null;
    title: string | null;
    location: string | null;
    description: string | null;
  },
): EventForm {
  const tz = event.timezone;
  const start = occurrence?.start ?? new Date(event.starts_at);
  const end = occurrence?.end ?? new Date(event.ends_at);
  const s = instantToLocal(start, tz);
  const e = instantToLocal(end, tz);
  return {
    calendarId: event.calendar_id,
    title: occurrence?.title ?? event.title ?? '',
    allDay: event.all_day,
    startDate: event.all_day ? (occurrence?.startDate ?? event.start_date ?? s.dateKey) : s.dateKey,
    startTime: s.time,
    endDate: event.all_day ? (occurrence?.endDate ?? event.end_date ?? s.dateKey) : e.dateKey,
    endTime: e.time,
    timezone: tz,
    location: occurrence?.location ?? event.location ?? '',
    address: event.address ?? '',
    url: event.url ?? '',
    description: occurrence?.description ?? event.description ?? '',
    eventType: event.event_type,
    status: event.status,
    privacy: event.privacy,
    color: event.color,
    assigneeId: event.assignee_id,
    attendeeIds: event.attendee_ids,
    reminders: event.my_reminders,
    recurrence: parseRule(event.recurrence_rule),
  };
}

/** Só os campos que mudaram (para enviar menos dados e facilitar a mesclagem). */
export function changedFields(
  original: Partial<Record<keyof EventFields, unknown>>,
  updated: EventFields,
): Partial<EventFields> {
  const changes: Partial<EventFields> = {};
  (Object.keys(updated) as (keyof EventFields)[]).forEach((key) => {
    const before = original[key] ?? null;
    const after = updated[key] ?? null;
    const same =
      key === 'starts_at' || key === 'ends_at'
        ? before !== null &&
          after !== null &&
          new Date(before as string).getTime() === new Date(after as string).getTime()
        : before === after;
    if (!same) (changes as Record<string, unknown>)[key] = after;
  });
  return changes;
}
