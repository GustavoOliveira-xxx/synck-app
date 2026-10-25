// Encontrar horário em comum numa agenda compartilhada. Usa só horários
// ocupados (sem títulos) que cada pessoa autorizou; nada é enviado sem
// confirmação. Sem horário para todos, dá para fazer uma enquete.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { DateTimeField } from '@/components/DateTimeField';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { SelectField } from '@/components/SelectField';
import { EmptyState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useAction } from '@/hooks/useAction';
import { useCalendar } from '@/hooks/useCalendar';
import { useCalendarMembers } from '@/hooks/useCalendarMembers';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { strings, t } from '@/i18n';
import type { CalendarEvent } from '@/models/types';
import * as api from '@/services/api';
import { createEvent } from '@/services/eventActions';
import { goBack } from '@/services/navigation';
import { useUserId } from '@/stores/authStore';
import { spacing } from '@/theme/tokens';
import {
  addDaysToKey,
  diffDays,
  formatTime,
  instantToLocal,
  startOfDayInstant,
  todayKey,
} from '@/utils/dates';
import { commonFree, mergeIntervals, startOptions, type Interval } from '@/utils/freeTime';
import { canCreateEvents } from '@/utils/permissions';
import { expandEvent } from '@/utils/recurrence';
import { newEventForm } from '@/validation/event';

import { estimateLabel } from '../tasks/TaskFormScreen';

const DURATIONS = [30, 45, 60, 90, 120, 180];

export default function FindTimeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const calendar = useCalendar(id);
  const members = useCalendarMembers(id);
  const userId = useUserId();
  const display = useDisplaySettings();
  const { toast, confirm } = useFeedback();
  const { run, busy } = useAction();
  const today = todayKey(display.timezone);
  const [people, setPeople] = useState<string[]>(userId ? [userId] : []);
  const [duration, setDuration] = useState(60);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDaysToKey(today, 7));
  const [title, setTitle] = useState('');
  const [results, setResults] = useState<Interval[] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);

  if (!calendar) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('errors.notFound')} />
      </Screen>
    );
  }

  const search = async () => {
    if (diffDays(to, from) > 60 || diffDays(to, from) < 0) {
      toast(t('findTime.rangeTooLong'), 'error');
      return;
    }
    const start = startOfDayInstant(from, display.timezone);
    const end = startOfDayInstant(addDaysToKey(to, 1), display.timezone);
    const result = await run(() => api.listBusyTimes(calendar.id, people, start, end));
    if (!result.ok) return;
    const byUser: Record<string, Interval[]> = {};
    for (const b of result.value) {
      const occurrences = expandEvent(
        {
          id: `${b.user_id}:${b.starts_at}`,
          starts_at: b.starts_at,
          ends_at: b.ends_at,
          all_day: b.all_day,
          start_date: b.start_date,
          end_date: b.end_date,
          timezone: b.timezone,
          recurrence_rule: b.recurrence_rule,
          exceptions: b.exceptions.map((x) => ({ ...x, title: null, description: null, location: null })),
          title: null,
          description: null,
          location: null,
        } as Pick<
          CalendarEvent,
          | 'id'
          | 'starts_at'
          | 'ends_at'
          | 'all_day'
          | 'start_date'
          | 'end_date'
          | 'timezone'
          | 'recurrence_rule'
          | 'exceptions'
          | 'title'
          | 'description'
          | 'location'
        >,
        start,
        end,
      );
      byUser[b.user_id] = [
        ...(byUser[b.user_id] ?? []),
        ...occurrences.map((o) => ({ start: o.start.getTime(), end: o.end.getTime() })),
      ];
    }
    const days: string[] = [];
    for (let d = from; d <= to; d = addDaysToKey(d, 1)) days.push(d);
    const slots = commonFree(
      Object.values(byUser).map(mergeIntervals),
      days,
      display.timezone,
      display.dayStart,
      display.dayEnd,
      duration,
      new Date(),
    );
    setResults(startOptions(slots, duration, 30, 30));
    setPicked([]);
  };

  const label = (i: Interval) => {
    const local = instantToLocal(new Date(i.start), display.timezone);
    const wd = new Date(`${local.dateKey}T12:00:00Z`).getUTCDay();
    return `${strings.weekdays.short[wd]} ${local.dateKey.slice(8)}/${local.dateKey.slice(5, 7)}, ${formatTime(new Date(i.start), display.timezone, display.timeFormat)} a ${formatTime(new Date(i.end), display.timezone, display.timeFormat)}`;
  };

  const schedule = async () => {
    if (!results || picked.length !== 1) return;
    const slot = results[picked[0]];
    const name = title.trim() || t('findTime.eventTitlePlaceholder').replace('Ex.: ', '');
    const ok = await confirm({
      title: t('findTime.confirmCreate', { when: label(slot), n: people.length }),
      confirmLabel: t('findTime.createEvent'),
    });
    if (!ok) return;
    const start = instantToLocal(new Date(slot.start), display.timezone);
    const end = instantToLocal(new Date(slot.end), display.timezone);
    await createEvent({
      ...newEventForm(calendar.id, display.timezone, start.dateKey),
      title: name,
      startDate: start.dateKey,
      startTime: start.time.slice(0, 5),
      endDate: end.dateKey,
      endTime: end.time.slice(0, 5),
      eventType: 'meeting',
      attendeeIds: people,
    });
    toast(t('findTime.created'));
    goBack();
  };

  const poll = async () => {
    if (!results || picked.length < 2) return;
    const result = await run(() =>
      api.createPoll({
        calendarId: calendar.id,
        title: title.trim() || t('findTime.eventTitlePlaceholder').replace('Ex.: ', ''),
        description: null,
        durationMinutes: duration,
        timezone: display.timezone,
        closesAt: null,
        participantIds: people,
        options: picked.map((i) => ({
          starts_at: new Date(results[i].start).toISOString(),
          ends_at: new Date(results[i].end).toISOString(),
        })),
      }),
    );
    if (result.ok) {
      toast(t('findTime.pollCreated'));
      router.replace({ pathname: '/calendar/[id]/polls', params: { id: calendar.id } });
    }
  };

  return (
    <Screen
      footer={
        results && picked.length > 0 ? (
          picked.length === 1 ? (
            <Button
              title={t('findTime.createEvent')}
              icon="calendar-outline"
              onPress={() => void schedule()}
              disabled={!canCreateEvents(calendar)}
            />
          ) : (
            <Button
              title={t('findTime.createPoll', { n: picked.length })}
              icon="poll-outline"
              onPress={() => void poll()}
              loading={busy}
            />
          )
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: t('findTime.title') }} />
      <AppText>{t('findTime.intro')}</AppText>
      <SectionHeader title={t('findTime.people')} />
      <View style={styles.chips}>
        {members.map((m) => {
          const on = people.includes(m.user_id);
          return (
            <Chip
              key={m.user_id}
              label={m.is_me ? t('common.you') : m.display_name}
              selected={on}
              onPress={() => setPeople(on ? people.filter((p) => p !== m.user_id) : [...people, m.user_id])}
            />
          );
        })}
      </View>
      <SelectField<number>
        label={t('findTime.duration')}
        value={duration}
        onChange={setDuration}
        options={DURATIONS.map((d) => ({ value: d, label: estimateLabel(d) }))}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <DateTimeField
            mode="date"
            label={t('findTime.from')}
            value={from}
            onChange={setFrom}
            dateFormat={display.dateFormat}
          />
        </View>
        <View style={styles.flex}>
          <DateTimeField
            mode="date"
            label={t('findTime.to')}
            value={to}
            onChange={setTo}
            dateFormat={display.dateFormat}
          />
        </View>
      </View>
      <AppText variant="small" tone="muted">
        {`${t('findTime.dayWindow')}: ${display.dayStart} a ${display.dayEnd}`}
      </AppText>
      <TextField
        label={t('findTime.eventTitle')}
        placeholder={t('findTime.eventTitlePlaceholder')}
        value={title}
        onChangeText={setTitle}
        maxLength={150}
      />
      <Button
        title={t('findTime.search')}
        icon="search"
        variant="secondary"
        onPress={() => void search()}
        loading={busy}
        disabled={people.length === 0}
      />

      {results && (
        <Card style={styles.gap}>
          <AppText variant="label">{t('findTime.results')}</AppText>
          <AppText variant="caption" tone="muted">
            {t('findTime.partialNote')}
          </AppText>
          {results.length === 0 ? (
            <>
              <AppText>{t('findTime.noResults')}</AppText>
              <AppText variant="small" tone="muted">
                {t('findTime.noResultsHint')}
              </AppText>
            </>
          ) : (
            <View style={styles.chips}>
              {results.map((r, i) => (
                <Chip
                  key={r.start}
                  label={label(r)}
                  selected={picked.includes(i)}
                  onPress={() =>
                    setPicked(picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i].slice(-20))
                  }
                />
              ))}
            </View>
          )}
          <AppText variant="caption" tone="muted">
            {t('findTime.pick')}
          </AppText>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
