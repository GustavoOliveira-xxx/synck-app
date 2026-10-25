// Reservar horário para uma tarefa: cria um bloco no calendário ligado à
// tarefa. A tarefa continua existindo; o bloco pode ser movido ou excluído.
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DateTimeField } from '@/components/DateTimeField';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { SelectField } from '@/components/SelectField';
import { EmptyState } from '@/components/StateViews';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useTask } from '@/hooks/useItems';
import { useFreeSlots } from '@/hooks/usePlanning';
import { strings, t } from '@/i18n';
import { createEvent } from '@/services/eventActions';
import { goBack } from '@/services/navigation';
import { useDataStore } from '@/stores/dataStore';
import { spacing } from '@/theme/tokens';
import { addDaysToKey, formatTime, instantToLocal, todayKey } from '@/utils/dates';
import { startOptions } from '@/utils/freeTime';
import { canCreateEvents } from '@/utils/permissions';
import { newEventForm } from '@/validation/event';

import { estimateLabel } from './TaskFormScreen';

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const pad = (n: number) => String(n).padStart(2, '0');

export default function TimeBlockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useTask(id);
  const display = useDisplaySettings();
  const { toast } = useFeedback();
  const calendars = useDataStore((s) => s.calendars).filter((c) => canCreateEvents(c));
  const today = todayKey(display.timezone);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i)), [today]);
  const [duration, setDuration] = useState(Math.min(180, task?.estimated_minutes ?? 60));
  const { slots } = useFreeSlots(days, duration);
  const options = useMemo(() => startOptions(slots, duration, 30, 6), [slots, duration]);
  // Agenda pessoal por padrão: tarefas privadas não vão para agendas compartilhadas sem a pessoa escolher.
  const [calendarId, setCalendarId] = useState(
    calendars.find((c) => c.kind === 'personal')?.id ?? calendars[0]?.id ?? '',
  );
  const first = options[0] ? instantToLocal(new Date(options[0].start), display.timezone) : null;
  const [date, setDate] = useState(first?.dateKey ?? today);
  const [time, setTime] = useState(first?.time.slice(0, 5) ?? '19:00');
  const [saving, setSaving] = useState(false);

  if (!task || !calendarId) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title={!task ? t('tasks.notFound') : t('planner.noPersonal')}
        />
      </Screen>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const base = newEventForm(calendarId, display.timezone, date);
      const [h, m] = time.split(':').map(Number);
      const endTotal = h * 60 + m + duration;
      const endDate = endTotal >= 1440 ? addDaysToKey(date, 1) : date;
      await createEvent(
        {
          ...base,
          title: task.title,
          startDate: date,
          startTime: time,
          endDate,
          endTime: `${pad(Math.floor((endTotal % 1440) / 60))}:${pad(endTotal % 60)}`,
          eventType: 'custom',
          privacy: 'members',
          reminders: [],
        },
        { task_id: task.id },
      );
      toast(t('tasks.blockCreated'));
      goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen footer={<Button title={t('tasks.reserveTime')} onPress={() => void save()} loading={saving} />}>
      <Stack.Screen options={{ title: t('tasks.reserveTime') }} />
      <AppText variant="heading">{task.title}</AppText>
      <AppText variant="small" tone="muted">
        {t('tasks.reserveHint')}
      </AppText>
      <SelectField<number>
        label={t('findTime.duration')}
        value={duration}
        onChange={setDuration}
        options={DURATIONS.map((d) => ({ value: d, label: estimateLabel(d) }))}
      />
      {options.length > 0 && (
        <View style={styles.gap}>
          <SectionHeader title={t('todayHub.freeSlots')} />
          <View style={styles.chips}>
            {options.map((o) => {
              const local = instantToLocal(new Date(o.start), display.timezone);
              const label = `${strings.weekdays.short[new Date(`${local.dateKey}T12:00:00Z`).getUTCDay()]} ${formatTime(new Date(o.start), display.timezone, display.timeFormat)}`;
              return (
                <Chip
                  key={o.start}
                  label={label}
                  selected={local.dateKey === date && local.time.slice(0, 5) === time}
                  onPress={() => {
                    setDate(local.dateKey);
                    setTime(local.time.slice(0, 5));
                  }}
                />
              );
            })}
          </View>
        </View>
      )}
      <View style={styles.row}>
        <View style={styles.flex}>
          <DateTimeField
            mode="date"
            label={t('events.startDate')}
            value={date}
            onChange={setDate}
            dateFormat={display.dateFormat}
          />
        </View>
        <View style={styles.flex}>
          <DateTimeField
            mode="time"
            label={t('events.startTime')}
            value={time}
            onChange={setTime}
            timeFormat={display.timeFormat}
          />
        </View>
      </View>
      <SelectField<string>
        label={t('planner.calendar')}
        value={calendarId}
        onChange={setCalendarId}
        options={calendars.map((c) => ({
          value: c.id,
          label: c.name,
          description: strings.calendarKinds[c.kind],
        }))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
