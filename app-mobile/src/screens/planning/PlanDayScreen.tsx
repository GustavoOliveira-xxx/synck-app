// "Seu dia": na primeira abertura de cada dia, o SynCK pergunta "O que você
// pretende fazer hoje?". Mostra o que já está marcado, o que ficou para trás,
// deixa escrever o que mais vai fazer e sugere o que a pessoa costuma fazer.
// As escolhas entram no "Meu dia" (task_plans): pessoal, não muda prazos.
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Kairo, StarBurst } from '@/components/brand/Decor';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { EnterItem, MotionView, PressableScale, tapFeedback } from '@/components/motion';
import { QuickAddBar } from '@/components/QuickAddBar';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { TaskCheck } from '@/components/TaskRow';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useHabits, useTasks } from '@/hooks/useItems';
import { useFreeSlots } from '@/hooks/usePlanning';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { useTaskActions } from '@/hooks/useTaskActions';
import { strings, t } from '@/i18n';
import type { Task } from '@/models/types';
import { createTask, logHabit, markCheckin, setTaskPlan } from '@/services/itemActions';
import { goBack } from '@/services/navigation';
import { useAuthStore, useUserId } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { addDaysToKey, capitalize, formatLongDate, formatTime, todayKey } from '@/utils/dates';
import { habitDoneOn, habitDueOn, suggestForToday, type DaySuggestion } from '@/utils/dailyPlan';
import { describeRule, parseRule } from '@/utils/recurrence';
import { describeDue, isOpen, isOverdue } from '@/utils/tasks';
import { newTaskForm } from '@/validation/task';

function hoursText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return t('tasks.estimateMinutes', { n: m });
  return m ? t('tasks.estimateHoursMinutes', { h, m }) : t('tasks.estimateHours', { h });
}

function reasonText(s: DaySuggestion, today: string): string {
  const r = s.reason;
  switch (r.key) {
    case 'habit':
      return t('planDay.reasonHabit');
    case 'recurring': {
      const rule = parseRule(r.rule);
      return rule && s.task?.due_date
        ? t('planDay.reasonRecurring', { rule: describeRule(rule, s.task.due_date).toLowerCase() })
        : t('tasks.recurring');
    }
    case 'weekday':
      return t('planDay.reasonWeekday', { weekday: strings.weekdays.plural[r.weekday] });
    case 'frequent':
      return t('planDay.reasonFrequent', { n: r.n });
    case 'important':
      return t('planDay.reasonImportant');
    case 'soon':
      return t('planDay.reasonSoon', { when: describeDue(s.task!, today) ?? '' });
  }
}

/** Linha com um botão de "pôr no meu dia" (ou tirar). */
function PlanRow({
  icon,
  title,
  subtitle,
  planned,
  onToggle,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  planned: boolean;
  onToggle: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <MotionView
      layout={LinearTransition.springify()}
      style={[styles.planRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <View style={[styles.planIcon, { backgroundColor: planned ? colors.primary : colors.primarySoft }]}>
        <Icon
          name={planned ? 'checkmark' : icon}
          size={18}
          color={planned ? colors.primaryText : colors.primaryInk}
        />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyMd" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <Button
        title={planned ? t('planDay.inMyDay') : t('planDay.addToDay')}
        variant={planned ? 'tonal' : 'secondary'}
        compact
        icon={planned ? 'checkmark' : 'add'}
        onPress={() => {
          tapFeedback(planned ? 'light' : 'success');
          onToggle();
        }}
        accessibilityHint={title}
      />
    </MotionView>
  );
}

export default function PlanDayScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const focused = useScreenFocus();
  const display = useDisplaySettings();
  const { toast } = useFeedback();
  const userId = useUserId();
  const name = useAuthStore((s) => s.account?.display_name ?? '');
  const setDismissed = useUiStore((s) => s.setPlanDismissedOn);
  const today = todayKey(display.timezone);
  const yesterday = addDaysToKey(today, -1);
  const tasks = useTasks();
  const habits = useHabits();
  const { slots, occurrences } = useFreeSlots([today]);
  const [burst, setBurst] = useState(0);
  const { toggle } = useTaskActions();

  // Já apareceu hoje: a tela Hoje não reabre a pergunta sozinha (também quando aberta pelo endereço).
  useEffect(() => {
    useUiStore.getState().setPlanShownOn(today);
  }, [today]);

  const openTask = (task: Task) => router.push({ pathname: '/task/[id]', params: { id: task.id } });
  const newItem = (kind: 'task' | 'event' | 'reminder') =>
    kind === 'event'
      ? router.push({ pathname: '/event/new', params: { date: today } })
      : router.push({ pathname: '/task/new', params: { type: kind, date: today, plan: today } });

  const events = occurrences
    .filter((o) => o.event.status !== 'cancelled')
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const open = tasks.filter(isOpen);
  const dueToday = open.filter((x) => x.due_date === today);
  const behind = open.filter(
    (x) => x.due_date !== today && (isOverdue(x, today) || x.plan_day === yesterday),
  );
  const planned = open.filter((x) => x.plan_day === today && x.due_date !== today);
  const habitsToday = habits.filter((h) => habitDueOn(h, today));
  const suggestions = suggestForToday({ tasks, habits, today, timezone: display.timezone, userId }).filter(
    (s) => s.kind !== 'habit' && !(s.task && s.task.plan_day === today),
  );
  const free = slots.reduce((sum, s) => sum + s.minutes, 0);
  const total = dueToday.length + planned.length + events.length;

  const togglePlan = (task: Task) => void setTaskPlan(task, task.plan_day === today ? null : today);

  const addSuggestion = async (s: DaySuggestion) => {
    if (s.task) await setTaskPlan(s.task, today);
    else await createTask(newTaskForm('task', display.timezone, { title: s.title }), { planDay: today });
    setBurst((b) => b + 1);
    toast(t('planDay.added'));
  };

  const finish = async () => {
    await markCheckin(today);
    setDismissed(null);
    toast(t('planDay.done'), 'success');
    goBack();
  };

  const later = () => {
    setDismissed(today);
    goBack();
  };

  const hour = new Date().getHours();
  const first = name.trim().split(/\s+/)[0] ?? '';
  const greeting =
    hour < 12
      ? t('today.morning', { name: first })
      : hour < 18
        ? t('today.afternoon', { name: first })
        : t('today.evening', { name: first });

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <View style={styles.flex}>
            <Button title={t('planDay.skip')} variant="ghost" onPress={later} />
          </View>
          <View style={styles.flex}>
            <Button
              title={t('planDay.start')}
              icon="sunny-outline"
              onPress={() => void finish()}
              testID="plan-start"
            />
          </View>
        </View>
      }
    >
      <Stack.Screen options={{ title: t('planDay.title'), headerShown: true }} />
      <MotionView
        entering={FadeIn.duration(260)}
        style={[styles.hero, { backgroundColor: colors.primarySoft, marginTop: insets.top ? 0 : spacing.xs }]}
      >
        <View style={styles.flex}>
          <AppText variant="overline" style={{ color: colors.primaryInk }}>
            {capitalize(formatLongDate(today))}
          </AppText>
          <AppText variant="caption" style={{ color: colors.primaryInk }}>
            {greeting}
          </AppText>
          <AppText
            variant="display"
            style={[styles.question, { color: colors.text }]}
            accessibilityRole="header"
          >
            {t('planDay.question')}
          </AppText>
          <AppText variant="small" tone="muted">
            {t('planDay.subtitle')}
          </AppText>
        </View>
        <View style={styles.mascot}>
          <Kairo size={92} paused={!focused} />
          <StarBurst trigger={burst} size={70} />
        </View>
      </MotionView>

      <View style={styles.stats}>
        <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="task-outline" size={18} color={colors.primaryInk} />
          <AppText variant="label">{t('planDay.summary', { n: total })}</AppText>
        </View>
        <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="time-outline" size={18} color={colors.primaryInk} />
          <AppText variant="label">{t('planDay.freeTime', { time: hoursText(free) })}</AppText>
        </View>
      </View>

      <SectionHeader title={t('planDay.agendaToday')} />
      {events.length === 0 && dueToday.length === 0 ? (
        <AppText tone="muted">{t('planDay.nothingScheduled')}</AppText>
      ) : (
        <Card style={styles.gapSm}>
          {events.map((o) => (
            <PressableScale
              key={o.key}
              style={styles.agendaRow}
              accessibilityRole="button"
              accessibilityLabel={o.event.is_masked ? t('events.maskedTitle') : (o.title ?? '')}
              onPress={() =>
                router.push({ pathname: '/event/[id]', params: { id: o.event.id, date: o.originalDate } })
              }
            >
              <AppText variant="time" style={[styles.time, { color: colors.primaryInk }]}>
                {o.allDay
                  ? t('calendarGrid.allDay')
                  : formatTime(o.start, display.timezone, display.timeFormat)}
              </AppText>
              <AppText style={styles.flex} numberOfLines={1}>
                {o.event.is_masked ? t('events.maskedTitle') : o.title}
              </AppText>
            </PressableScale>
          ))}
          {dueToday.map((task) => (
            <PressableScale
              key={task.id}
              style={styles.agendaRow}
              accessibilityRole="button"
              accessibilityLabel={task.title}
              onPress={() => openTask(task)}
            >
              <TaskCheck
                done={false}
                priority={task.priority}
                reminder={task.item_type === 'reminder'}
                label={`${t('tasks.complete')}: ${task.title}`}
                onPress={() => void toggle(task)}
              />
              <AppText style={styles.flex} numberOfLines={1}>
                {task.title}
              </AppText>
              <AppText variant="caption" tone="muted">
                {describeDue(task, today, display.timeFormat)}
              </AppText>
            </PressableScale>
          ))}
        </Card>
      )}

      {behind.length > 0 && (
        <>
          <SectionHeader title={t('planDay.overdue')} />
          <AppText variant="small" tone="muted">
            {t('planDay.overdueHint')}
          </AppText>
          {behind.slice(0, 8).map((task, i) => (
            <EnterItem key={task.id} index={i}>
              <PlanRow
                icon={task.item_type === 'reminder' ? 'notifications-outline' : 'task-outline'}
                title={task.title}
                subtitle={
                  task.plan_day === yesterday
                    ? t('planDay.yesterday')
                    : (describeDue(task, today) ?? undefined)
                }
                planned={task.plan_day === today}
                onToggle={() => togglePlan(task)}
              />
            </EnterItem>
          ))}
        </>
      )}

      <SectionHeader title={t('planDay.addLabel')} />
      <QuickAddBar
        planDay={today}
        placeholder={t('planDay.addPlaceholder')}
        onSaved={() => setBurst((b) => b + 1)}
      />
      <AppText variant="small" tone="muted">
        {t('planDay.detailedHint')}
      </AppText>
      <View style={styles.newRow}>
        <Button
          title={t('create.task')}
          icon="task-outline"
          variant="secondary"
          compact
          onPress={() => newItem('task')}
        />
        <Button
          title={t('create.event')}
          icon="calendar-outline"
          variant="secondary"
          compact
          onPress={() => newItem('event')}
        />
        <Button
          title={t('create.reminder')}
          icon="notifications-outline"
          variant="secondary"
          compact
          onPress={() => newItem('reminder')}
        />
      </View>
      {planned.map((task) => (
        <MotionView key={task.id} entering={FadeInDown.duration(220)} layout={LinearTransition.springify()}>
          <View style={[styles.plannedRow, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <PressableScale
              style={styles.plannedMain}
              accessibilityRole="button"
              accessibilityLabel={`${task.title}. ${t('planDay.editHint')}`}
              onPress={() => openTask(task)}
            >
              <Icon name="sunny-outline" size={18} color={colors.primaryInk} />
              <View style={styles.flex}>
                <AppText numberOfLines={2}>{task.title}</AppText>
                {describeDue(task, today, display.timeFormat) ? (
                  <AppText variant="caption" tone="muted">
                    {describeDue(task, today, display.timeFormat)}
                  </AppText>
                ) : null}
              </View>
            </PressableScale>
            <IconButton
              icon="close"
              label={`${t('tasks.planRemove')}: ${task.title}`}
              onPress={() => togglePlan(task)}
            />
          </View>
        </MotionView>
      ))}

      {habitsToday.length > 0 && (
        <>
          <SectionHeader title={t('planDay.habitsToday')} />
          {habitsToday.map((h) => {
            const done = habitDoneOn(h, today, userId);
            return (
              <PressableScale
                key={h.id}
                onPress={() => void logHabit(h, today, !done)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={h.title}
                style={[styles.plannedRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Icon
                  name={done ? 'checkmark-circle' : 'leaf-outline'}
                  size={20}
                  color={done ? colors.primary : colors.textMuted}
                />
                <AppText style={styles.flex}>{h.title}</AppText>
                <AppText variant="caption" tone="muted">
                  {done ? t('habits.doneToday') : t('habits.markDone')}
                </AppText>
              </PressableScale>
            );
          })}
        </>
      )}

      <SectionHeader title={t('planDay.suggestions')} />
      <AppText variant="small" tone="muted">
        {suggestions.length ? t('planDay.suggestionsHint') : t('planDay.noSuggestions')}
      </AppText>
      {suggestions.map((s, i) => (
        <EnterItem key={s.id} index={i}>
          <PlanRow
            icon={s.kind === 'title' ? 'refresh' : 'repeat'}
            title={s.title}
            subtitle={reasonText(s, today)}
            planned={false}
            onToggle={() => void addSuggestion(s)}
          />
        </EnterItem>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gapSm: { gap: spacing.sm },
  footer: { flexDirection: 'row', gap: spacing.md },
  newRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  plannedMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 },
  hero: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  question: { fontSize: 26, lineHeight: 31, marginVertical: spacing.xs },
  mascot: { width: 92, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  agendaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  time: { width: 52 },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  planIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  plannedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
