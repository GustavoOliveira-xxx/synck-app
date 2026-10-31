// Criação e edição de eventos (inclusive "só esta ocorrência" e "esta e as próximas").
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ColorPicker } from '@/components/ColorPicker';
import { RecurrenceEditor } from '@/components/RecurrenceEditor';
import { DateTimeField } from '@/components/DateTimeField';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { SelectField } from '@/components/SelectField';
import { EmptyState } from '@/components/StateViews';
import { SwitchRow } from '@/components/SwitchRow';
import { TextField } from '@/components/TextField';
import { useCalendarMembers } from '@/hooks/useCalendarMembers';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useCalendarsMap, useEventsMap, useOccurrences } from '@/hooks/useEventsView';
import { strings, t } from '@/i18n';
import type {
  Calendar,
  CalendarEvent,
  EventPrivacy,
  EventStatus,
  EventType,
  Occurrence,
} from '@/models/types';
import { createEvent, updateEvent, type RecurrenceScope } from '@/services/eventActions';
import { requestPermission } from '@/services/localNotifications';
import { goBack } from '@/services/navigation';
import { useAuthStore, useUserId } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, spacing } from '@/theme/tokens';
import { findConflicts } from '@/utils/conflicts';
import { todayKey } from '@/utils/dates';
import { canCreateEvents } from '@/utils/permissions';
import { expandEvent } from '@/utils/recurrence';
import { timezoneOptions } from '@/utils/timezones';
import {
  eventToForm,
  formDuration,
  formInstants,
  newEventForm,
  validateEventForm,
  withDuration,
  withStart,
  type EventForm,
} from '@/validation/event';

import { ReminderPicker } from './ReminderPicker';

const TYPES = Object.keys(strings.eventTypes) as EventType[];
const STATUSES = Object.keys(strings.eventStatus) as EventStatus[];
const PRIVACIES = Object.keys(strings.privacy) as EventPrivacy[];
/** Durações mais comuns, em minutos, para não precisar acertar o horário de término. */
const DURATIONS = [30, 60, 90, 120];

function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m}` : `${h} h`;
}

function Form({
  initial,
  event,
  occurrence,
  scope,
  calendars,
}: {
  initial: EventForm;
  event?: CalendarEvent;
  occurrence?: Occurrence;
  scope: RecurrenceScope;
  calendars: Calendar[];
}) {
  const display = useDisplaySettings();
  const { dark } = useAppTheme();
  const userId = useUserId();
  const { toast } = useFeedback();
  const online = useSyncStore((s) => s.online);
  const [base] = useState(initial);
  const [form, setForm] = useState<EventForm>(initial);
  const [errors, setErrors] = useState<ReturnType<typeof validateEventForm>>({});
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(!!event);
  const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(base), [form, base]);
  const { allowLeave } = useUnsavedChanges(dirty && !saving);
  const duration = formDuration(form);
  const calendar = calendars.find((c) => c.id === form.calendarId);
  const onlyThis = scope === 'this' && !!event?.recurrence_rule;

  // Conflito de horário (regra 30): avisa sem impedir, salvo se a agenda bloquear.
  const instants = formInstants(form);
  const dayStart = instants?.start ?? new Date();
  const around = useOccurrences(
    new Date(dayStart.getTime() - 86_400_000),
    new Date(dayStart.getTime() + 2 * 86_400_000),
  );
  const conflicts = useMemo(() => {
    if (!instants || !calendar || calendar.conflict_policy === 'ignore') return [];
    return findConflicts(
      { ...instants, allDay: form.allDay },
      around.filter((o) => o.event.calendar_id === form.calendarId),
      event?.id,
    );
  }, [instants, calendar, around, form.allDay, form.calendarId, event?.id]);

  const people = useCalendarMembers(form.calendarId);

  // Mudar o início leva o término junto (a duração continua a mesma).
  const setStartDate = (v: string) => setForm((f) => withStart(f, v, f.startTime));
  const setStartTime = (v: string) => setForm((f) => withStart(f, f.startDate, v));

  const save = async () => {
    const v = validateEventForm(form);
    setErrors(v);
    if (Object.keys(v).length) {
      toast(t('errors.invalidData'), 'error');
      return;
    }
    if (calendar?.conflict_policy === 'block' && conflicts.length) {
      toast(t('events.conflictBlocked'), 'error');
      return;
    }
    if (form.privacy === 'private' && calendar && !calendar.allow_private_events) {
      toast(t('errors.privateDisabled'), 'error');
      return;
    }
    setSaving(true);
    try {
      if (form.reminders.length) await requestPermission().catch(() => false);
      if (event) await updateEvent(event, form, scope, occurrence);
      else await createEvent(form);
      toast(online ? (event ? t('events.updated') : t('events.created')) : t('events.savedOffline'));
      allowLeave();
      goBack();
    } catch {
      toast(t('errors.generic'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen footer={<Button title={t('common.save')} onPress={save} loading={saving} testID="event-save" />}>
      <TextField
        label={t('events.titleLabel')}
        placeholder={t('events.titlePlaceholder')}
        value={form.title}
        onChangeText={(v) => set('title', v)}
        error={errors.title}
        maxLength={150}
        autoFocus={!event && !initial.title}
        testID="event-title"
      />
      {!event &&
        (calendars.length <= 8 ? (
          <View style={styles.field}>
            <AppText variant="label">{t('events.calendar')}</AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scrollChips}
            >
              {calendars.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  color={agendaColor(c.color, dark)}
                  selected={form.calendarId === c.id}
                  accessibilityLabel={`${c.name}, ${strings.calendarKinds[c.kind]}`}
                  onPress={() =>
                    setForm((f) => ({ ...f, calendarId: c.id, attendeeIds: [], assigneeId: null }))
                  }
                />
              ))}
            </ScrollView>
          </View>
        ) : (
          <SelectField<string>
            label={t('events.calendar')}
            value={form.calendarId}
            onChange={(v) => {
              setForm((f) => ({ ...f, calendarId: v, attendeeIds: [], assigneeId: null }));
            }}
            options={calendars.map((c) => ({
              value: c.id,
              label: c.name,
              description: strings.calendarKinds[c.kind],
            }))}
          />
        ))}
      {!onlyThis && (
        <SwitchRow label={t('events.allDay')} value={form.allDay} onChange={(v) => set('allDay', v)} />
      )}
      <View style={styles.row}>
        <DateTimeField
          mode="date"
          label={t('events.startDate')}
          value={form.startDate}
          onChange={setStartDate}
          dateFormat={display.dateFormat}
          error={errors.start}
        />
        {!form.allDay && (
          <DateTimeField
            mode="time"
            label={t('events.startTime')}
            value={form.startTime}
            onChange={setStartTime}
            timeFormat={display.timeFormat}
          />
        )}
      </View>
      <View style={styles.row}>
        <DateTimeField
          mode="date"
          label={t('events.endDate')}
          value={form.endDate}
          onChange={(v) => set('endDate', v)}
          dateFormat={display.dateFormat}
          error={errors.end}
        />
        {!form.allDay && (
          <DateTimeField
            mode="time"
            label={t('events.endTime')}
            value={form.endTime}
            onChange={(v) => set('endTime', v)}
            timeFormat={display.timeFormat}
          />
        )}
      </View>
      {!form.allDay && (
        <View style={styles.field}>
          <AppText variant="label">{t('events.duration')}</AppText>
          <View style={styles.chipsWrap}>
            {DURATIONS.map((m) => (
              <Chip
                key={m}
                label={durationLabel(m)}
                selected={duration === m}
                onPress={() => setForm((f) => withDuration(f, m))}
              />
            ))}
          </View>
        </View>
      )}
      {conflicts.length > 0 && (
        <AppText tone="warning" accessibilityLiveRegion="polite">
          {conflicts.length === 1
            ? t('events.conflictWarning', {
                title: conflicts[0].event.is_masked ? t('common.busy') : (conflicts[0].title ?? ''),
              })
            : t('events.conflictWarningMany', { n: conflicts.length })}
          {calendar?.conflict_policy === 'block' ? ` ${t('events.conflictBlocked')}` : ''}
        </AppText>
      )}
      {!onlyThis && (
        <RecurrenceEditor
          rule={form.recurrence}
          startDate={form.startDate}
          onChange={(r) => set('recurrence', r)}
          error={errors.recurrence}
        />
      )}
      <TextField
        label={`${t('events.location')} (${t('common.optional')})`}
        placeholder={t('events.locationPlaceholder')}
        value={form.location}
        onChangeText={(v) => set('location', v)}
        error={errors.location}
        maxLength={200}
      />
      <ReminderPicker value={form.reminders} onChange={(v) => set('reminders', v)} error={errors.reminders} />

      <Button
        title={showMore ? t('events.lessOptions') : t('events.moreOptions')}
        icon={showMore ? 'chevron-up' : 'chevron-down'}
        variant="ghost"
        onPress={() => setShowMore((s) => !s)}
      />
      {showMore && (
        <>
          <TextField
            label={`${t('events.description')} (${t('common.optional')})`}
            value={form.description}
            onChangeText={(v) => set('description', v)}
            error={errors.description}
            multiline
            maxLength={5000}
          />
          {!onlyThis && (
            <>
              <TextField
                label={`${t('events.address')} (${t('common.optional')})`}
                value={form.address}
                onChangeText={(v) => set('address', v)}
                error={errors.address}
                maxLength={300}
              />
              <TextField
                label={`${t('events.link')} (${t('common.optional')})`}
                placeholder={t('events.linkPlaceholder')}
                value={form.url}
                onChangeText={(v) => set('url', v)}
                error={errors.url}
                keyboardType="url"
                autoCapitalize="none"
              />
              <SelectField<EventType>
                label={t('events.type')}
                value={form.eventType}
                onChange={(v) => set('eventType', v)}
                options={TYPES.filter(
                  // Tarefas e lembretes têm módulo próprio; eventos antigos desses tipos continuam editáveis.
                  (v) => (v !== 'task' && v !== 'reminder') || v === initial.eventType,
                ).map((v) => ({ value: v, label: strings.eventTypes[v] }))}
              />
              <SelectField<EventStatus>
                label={t('events.status')}
                value={form.status}
                onChange={(v) => set('status', v)}
                options={STATUSES.map((v) => ({ value: v, label: strings.eventStatus[v] }))}
              />
              <SelectField<EventPrivacy>
                label={t('events.privacy')}
                value={form.privacy}
                onChange={(v) => set('privacy', v)}
                options={PRIVACIES.map((v) => ({
                  value: v,
                  label: strings.privacy[v],
                  description: strings.privacyDescriptions[v],
                  disabled: v === 'private' && calendar ? !calendar.allow_private_events : false,
                }))}
              />
              <ColorPicker
                label={t('events.color')}
                value={form.color}
                onChange={(v) => set('color', v)}
                allowNone
                noneLabel={t('events.useCalendarColor')}
              />
              {people.length > 0 && (
                <>
                  <SelectField<string | null>
                    label={t('events.assignee')}
                    value={form.assigneeId}
                    onChange={(v) => set('assigneeId', v)}
                    options={[
                      { value: null, label: t('events.noAssignee') },
                      ...people.map((p) => ({
                        value: p.user_id as string | null,
                        label: p.is_me ? t('common.you') : p.display_name,
                      })),
                    ]}
                  />
                  <SectionHeader title={t('events.participants')} />
                  <AppText variant="small" tone="muted">
                    {t('events.participantsHint')}
                  </AppText>
                  <View style={styles.chips}>
                    {people.map((p) => {
                      const selected = form.attendeeIds.includes(p.user_id);
                      return (
                        <Chip
                          key={p.user_id}
                          label={p.user_id === userId ? t('common.you') : p.display_name}
                          selected={selected}
                          onPress={() =>
                            set(
                              'attendeeIds',
                              selected
                                ? form.attendeeIds.filter((x) => x !== p.user_id)
                                : [...form.attendeeIds, p.user_id],
                            )
                          }
                        />
                      );
                    })}
                  </View>
                </>
              )}
              <SelectField<string>
                label={t('events.timezone')}
                value={form.timezone}
                onChange={(v) => set('timezone', v)}
                options={timezoneOptions(display.timezone)}
                searchable
                searchPlaceholder={t('preferences.searchTimezone')}
              />
            </>
          )}
        </>
      )}
    </Screen>
  );
}

/** Rota /event/new (com ?date= e ?calendarId=) e /event/[id]/edit (com ?date= e ?scope=). */
export default function EventFormScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    date?: string;
    calendarId?: string;
    scope?: RecurrenceScope;
    /** Vindos da adição rápida. */
    title?: string;
    start?: string;
    end?: string;
  }>();
  const display = useDisplaySettings();
  const account = useAuthStore((s) => s.account);
  const allCalendars = useDataStore((s) => s.calendars);
  const calendarsMap = useCalendarsMap();
  const events = useEventsMap();
  const writable = useMemo(() => allCalendars.filter((c) => canCreateEvents(c)), [allCalendars]);

  const event = params.id ? events[params.id] : undefined;
  const scope: RecurrenceScope = params.scope ?? 'all';
  const occurrence = useMemo(() => {
    if (!event || !params.date) return undefined;
    const day = new Date(`${params.date}T00:00:00Z`);
    return expandEvent(
      event,
      new Date(day.getTime() - 2 * 86_400_000),
      new Date(day.getTime() + 3 * 86_400_000),
    ).find((o) => o.originalDate === params.date);
  }, [event, params.date]);

  if (params.id && !event) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('events.notFound')} />
      </Screen>
    );
  }
  if (!params.id && writable.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="albums-outline"
          title={t('calendars.emptyTitle')}
          message={t('calendars.emptyMessage')}
        />
      </Screen>
    );
  }

  let initial: EventForm;
  if (event) {
    // "Todas": formulário com a série; "só esta" / "esta e as próximas": com a ocorrência.
    initial = eventToForm(event, occurrence);
  } else {
    const preferred =
      writable.find((c) => c.id === params.calendarId) ??
      writable.find((c) => c.kind !== 'personal') ??
      writable[0];
    // O evento nasce no fuso em que a pessoa está (pode ser trocado em "Mais opções").
    initial = newEventForm(
      preferred.id,
      display.timezone,
      params.date ?? todayKey(display.timezone),
      new Date(),
      account?.notification_preferences.default_reminder_minutes ?? null,
    );
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (params.title) initial.title = params.title.slice(0, 150);
    if (params.start && time.test(params.start)) {
      // Começa no horário pedido e dura 1 h (às 23:30, termina 00:30 do dia seguinte).
      initial = withDuration({ ...initial, startDate: initial.startDate, startTime: params.start }, 60);
    }
    if (params.end && time.test(params.end) && params.end > initial.startTime) {
      initial = { ...initial, endDate: initial.startDate, endTime: params.end };
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: event ? t('events.edit') : t('events.new') }} />
      <Form
        initial={initial}
        event={event}
        occurrence={occurrence}
        scope={scope}
        calendars={event ? [calendarsMap[event.calendar_id]].filter(Boolean) : writable}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  field: { gap: spacing.sm },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gap: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  scrollChips: { gap: spacing.sm, paddingRight: spacing.lg },
});
