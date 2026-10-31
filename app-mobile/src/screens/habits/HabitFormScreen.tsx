// Criar e editar hábitos: frequência (todo dia, dias da semana, um dia do
// mês), de quem é a rotina (só minha ou de uma agenda) e sequência opcional.
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ColorPicker } from '@/components/ColorPicker';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SelectField } from '@/components/SelectField';
import { EmptyState } from '@/components/StateViews';
import { SwitchRow } from '@/components/SwitchRow';
import { TextField } from '@/components/TextField';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useItems } from '@/hooks/useItems';
import { strings, t } from '@/i18n';
import { createHabit, updateHabit } from '@/services/itemActions';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { goBack } from '@/services/navigation';
import { useDataStore } from '@/stores/dataStore';
import { spacing } from '@/theme/tokens';
import { todayKey } from '@/utils/dates';
import { canCreateEvents } from '@/utils/permissions';
import { parseRule, serializeRule, WEEKDAY_CODES, type WeekdayCode } from '@/utils/recurrence';

type Mode = 'daily' | 'weekdays' | 'monthly';

export default function HabitFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { habits } = useItems();
  const habit = id ? habits[id] : undefined;
  const display = useDisplaySettings();
  const { toast } = useFeedback();
  const calendars = useDataStore((s) => s.calendars).filter(
    (c) => canCreateEvents(c) && c.kind !== 'personal',
  );
  const rule = parseRule(habit?.recurrence_rule ?? 'FREQ=DAILY');
  const [title, setTitle] = useState(habit?.title ?? '');
  const [description, setDescription] = useState(habit?.description ?? '');
  const [mode, setMode] = useState<Mode>(
    rule?.freq === 'MONTHLY' ? 'monthly' : rule?.freq === 'WEEKLY' ? 'weekdays' : 'daily',
  );
  const [days, setDays] = useState<WeekdayCode[]>(rule?.byDay.length ? rule.byDay : ['MO', 'WE', 'FR']);
  const [monthDay, setMonthDay] = useState(String(rule?.byMonthDay ?? 1));
  const [calendarId, setCalendarId] = useState<string | null>(habit?.calendar_id ?? null);
  const [color, setColor] = useState<string | null>(habit?.color ?? null);
  const [streak, setStreak] = useState(habit?.show_streak ?? false);
  const [error, setError] = useState<string>();
  const { allowLeave } = useUnsavedChanges(
    title !== (habit?.title ?? '') || description !== (habit?.description ?? ''),
  );

  if (id && !habit) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('errors.notFound')} />
      </Screen>
    );
  }

  const ruleText = () => {
    if (mode === 'daily') return 'FREQ=DAILY';
    if (mode === 'weekdays')
      return serializeRule({
        freq: 'WEEKLY',
        interval: 1,
        byDay: days,
        byMonthDay: null,
        until: null,
        count: null,
      });
    const d = Math.max(1, Math.min(31, Number(monthDay) || 1));
    return `FREQ=MONTHLY;BYMONTHDAY=${d}`;
  };

  const save = async () => {
    if (!title.trim()) {
      setError(t('validation.required'));
      return;
    }
    if (mode === 'weekdays' && days.length === 0) {
      setError(t('validation.weekdaysRequired'));
      return;
    }
    const fields = {
      title: title.trim(),
      description: description.trim() || null,
      recurrence_rule: ruleText(),
      show_streak: streak,
      color,
    };
    if (habit) await updateHabit(habit, fields);
    else await createHabit({ ...fields, calendar_id: calendarId, start_date: todayKey(display.timezone) });
    toast(t('habits.saved'));
    allowLeave();
    goBack();
  };

  return (
    <Screen footer={<Button title={t('common.save')} onPress={() => void save()} />}>
      <Stack.Screen options={{ title: habit ? t('habits.edit') : t('habits.new') }} />
      <TextField
        label={t('habits.titleLabel')}
        placeholder={t('habits.titlePlaceholder')}
        value={title}
        onChangeText={setTitle}
        error={error}
        maxLength={100}
        autoFocus={!habit}
      />
      <AppText variant="label">{t('habits.frequency')}</AppText>
      <SegmentedControl<Mode>
        label={t('habits.frequency')}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'daily', label: t('habits.daily') },
          { value: 'weekdays', label: t('habits.weekdays') },
          { value: 'monthly', label: t('habits.monthly') },
        ]}
      />
      {mode === 'weekdays' && (
        <View style={styles.chips}>
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
            const code = WEEKDAY_CODES[wd];
            const on = days.includes(code);
            return (
              <Chip
                key={code}
                label={strings.weekdays.short[wd]}
                accessibilityLabel={strings.weekdays.long[wd]}
                selected={on}
                onPress={() => setDays(on ? days.filter((d) => d !== code) : [...days, code])}
              />
            );
          })}
        </View>
      )}
      {mode === 'monthly' && (
        <TextField
          label={t('habits.monthDay')}
          value={monthDay}
          onChangeText={(v) => setMonthDay(v.replace(/\D/g, '').slice(0, 2))}
          keyboardType="number-pad"
        />
      )}
      {!habit && calendars.length > 0 && (
        <SelectField<string | null>
          label={t('habits.calendar')}
          value={calendarId}
          onChange={setCalendarId}
          options={[
            { value: null, label: t('tasks.personal') },
            ...calendars.map((c) => ({ value: c.id as string | null, label: c.name })),
          ]}
        />
      )}
      <TextField
        label={`${t('tasks.description')} (${t('common.optional')})`}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={1000}
      />
      <ColorPicker
        label={t('calendars.color')}
        value={color}
        onChange={setColor}
        allowNone
        noneLabel={t('events.useCalendarColor')}
      />
      <SwitchRow label={t('habits.showStreak')} value={streak} onChange={setStreak} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
