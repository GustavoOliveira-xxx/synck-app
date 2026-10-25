// Hábitos e rotinas: registrar quando fizer, ver as últimas semanas, pausar
// e arquivar. Não ocupam horário na agenda. Sequência só se a pessoa ligar.
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FAB } from '@/components/FAB';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { EnterItem, PressableScale, tapFeedback } from '@/components/motion';
import { OptionSheet } from '@/components/OptionSheet';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/StateViews';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useCalendarsMap } from '@/hooks/useEventsView';
import { useHabits } from '@/hooks/useItems';
import { strings, t } from '@/i18n';
import type { Habit } from '@/models/types';
import { deleteHabit, logHabit, updateHabit } from '@/services/itemActions';
import { useUserId } from '@/stores/authStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, radius, spacing } from '@/theme/tokens';
import { addDaysToKey, todayKey, weekdayOfKey } from '@/utils/dates';
import { habitDoneOn, habitDueOn, habitStreak } from '@/utils/dailyPlan';
import { describeRule, parseRule } from '@/utils/recurrence';

const WEEKS = 4;

function HabitCard({
  habit,
  today,
  index,
  onMenu,
}: {
  habit: Habit;
  today: string;
  index: number;
  onMenu: () => void;
}) {
  const { colors, dark } = useAppTheme();
  const userId = useUserId();
  const calendars = useCalendarsMap();
  const due = habitDueOn(habit, today);
  const done = habitDoneOn(habit, today, userId);
  const rule = parseRule(habit.recurrence_rule);
  const color =
    agendaColor(habit.color ?? (habit.calendar_id ? calendars[habit.calendar_id]?.color : null), dark) ??
    colors.primary;
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => addDaysToKey(today, i - WEEKS * 7 + 1));
  const othersToday = habit.calendar_id
    ? habit.logs.filter((l) => l.day === today && l.user_id !== userId).length
    : 0;
  return (
    <EnterItem index={index}>
      <Card style={styles.gap}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <View style={styles.flex}>
            <AppText variant="heading" numberOfLines={1}>
              {habit.title}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {[
                rule ? describeRule(rule, habit.start_date) : '',
                habit.calendar_id ? calendars[habit.calendar_id]?.name : '',
                habit.status === 'paused' ? t('habits.paused') : '',
                habit.show_streak ? t('habits.streak', { n: habitStreak(habit, today, userId) }) : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </View>
          <IconButton icon="ellipsis-horizontal" label={habit.title} onPress={onMenu} />
        </View>
        <View style={styles.history} accessibilityLabel={t('habits.history')}>
          {days.map((d) => {
            const isDue = habitDueOn(habit, d);
            const isDone = habitDoneOn(habit, d, userId);
            return (
              <PressableScale
                key={d}
                onPress={() => {
                  if (d > today) return;
                  tapFeedback(isDone ? 'light' : 'success');
                  void logHabit(habit, d, !isDone);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDone }}
                accessibilityLabel={`${strings.weekdays.long[weekdayOfKey(d)]} ${d.slice(8)}/${d.slice(5, 7)}`}
                style={[
                  styles.cell,
                  {
                    backgroundColor: isDone ? color : isDue ? colors.surfaceAlt : 'transparent',
                    borderColor: d === today ? colors.text : isDue ? colors.border : colors.surfaceAlt,
                  },
                ]}
              />
            );
          })}
        </View>
        {habit.status === 'active' && (
          <Button
            title={!due ? t('habits.notToday') : done ? t('habits.doneToday') : t('habits.markDone')}
            icon={done ? 'checkmark' : 'leaf-outline'}
            variant={done ? 'tonal' : 'primary'}
            compact
            onPress={() => {
              tapFeedback(done ? 'light' : 'success');
              void logHabit(habit, today, !done);
            }}
          />
        )}
        {othersToday > 0 && (
          <AppText variant="caption" tone="muted">
            {t('habits.others', { n: othersToday })}
          </AppText>
        )}
      </Card>
    </EnterItem>
  );
}

export default function HabitsScreen() {
  const { colors } = useAppTheme();
  const display = useDisplaySettings();
  const habits = useHabits();
  const today = todayKey(display.timezone);
  const [menu, setMenu] = useState<Habit | null>(null);
  const active = habits.filter((h) => h.status !== 'archived');
  const archived = habits.filter((h) => h.status === 'archived');

  const act = async (habit: Habit, action: string) => {
    setMenu(null);
    if (action === 'edit') router.push({ pathname: '/habits/[id]', params: { id: habit.id } });
    if (action === 'pause') await updateHabit(habit, { status: 'paused' });
    if (action === 'resume') await updateHabit(habit, { status: 'active' });
    if (action === 'archive') await updateHabit(habit, { status: 'archived' });
    if (action === 'delete') await deleteHabit(habit);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Screen withFab>
        <Stack.Screen options={{ title: t('habits.title') }} />
        {habits.length === 0 ? (
          <EmptyState
            art="kairo"
            title={t('habits.empty')}
            message={t('habits.emptyMessage')}
            actionLabel={t('habits.new')}
            onAction={() => router.push('/habits/new')}
          />
        ) : (
          <>
            {active.map((h, i) => (
              <HabitCard key={h.id} habit={h} today={today} index={i} onMenu={() => setMenu(h)} />
            ))}
            {archived.length > 0 && (
              <>
                <SectionHeader title={t('habits.archived')} />
                {archived.map((h) => (
                  <Card key={h.id} onPress={() => setMenu(h)} style={styles.row}>
                    <Icon name="archive-outline" size={18} color={colors.textMuted} />
                    <AppText style={styles.flex}>{h.title}</AppText>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </Screen>
      <FAB label={t('habits.new')} onPress={() => router.push('/habits/new')} />
      {menu && (
        <OptionSheet<string | null>
          visible
          title={menu.title}
          value={null}
          options={[
            { value: 'edit', label: t('common.edit') },
            menu.status === 'active'
              ? { value: 'pause', label: t('habits.pause') }
              : { value: 'resume', label: t('habits.resume') },
            ...(menu.status !== 'archived' ? [{ value: 'archive', label: t('habits.archive') }] : []),
            { value: 'delete', label: t('common.delete') },
          ]}
          onSelect={(v) => v && void act(menu, v)}
          onClose={() => setMenu(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  history: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { width: 18, height: 18, borderRadius: radius.xs, borderWidth: 1 },
});
