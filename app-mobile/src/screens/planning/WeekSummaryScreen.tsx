// "Minha semana em sintonia": compromissos, prazos, pendências, tempo livre,
// agendas compartilhadas e sobreposições da semana, com sugestões neutras.
import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { GlassSphere } from '@/components/brand/Decor';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon, type IconName } from '@/components/Icon';
import { EnterItem } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useCalendarsMap } from '@/hooks/useEventsView';
import { useTasks } from '@/hooks/useItems';
import { useNow } from '@/hooks/useNow';
import { useFreeSlots } from '@/hooks/usePlanning';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import {
  addDaysToKey,
  capitalize,
  formatLongDate,
  formatShortDate,
  formatTime,
  toDateKey,
  todayKey,
} from '@/utils/dates';
import { describeDue } from '@/utils/tasks';
import { summarizeWeek } from '@/utils/weekSummary';

function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name={icon} size={20} color={colors.primaryInk} />
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="heading">{value}</AppText>
    </View>
  );
}

export default function WeekSummaryScreen() {
  const { colors } = useAppTheme();
  const now = useNow(5 * 60_000);
  const display = useDisplaySettings();
  const focused = useScreenFocus();
  const today = todayKey(display.timezone);
  // Sempre os próximos 7 dias a partir de hoje: no fim de semana o resumo já olha a semana seguinte.
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i)), [today]);
  const { slots, occurrences } = useFreeSlots(days, 30);
  const tasks = useTasks();
  const calendars = useCalendarsMap();
  const summary = useMemo(
    () => summarizeWeek({ occurrences, tasks, calendars, days, today, slots, now: new Date(now) }),
    [occurrences, tasks, calendars, days, today, slots, now],
  );
  const hours = Math.round(summary.freeMinutes / 60);

  const suggestion = (s: (typeof summary.suggestions)[number]) => {
    switch (s.key) {
      case 'plan':
        return { text: t('weekSummary.suggestionPlan', { n: s.n }), action: () => router.push('/planner') };
      case 'overdue':
        return { text: t('weekSummary.suggestionOverdue', { n: s.n }), action: () => router.push('/tasks') };
      case 'conflicts':
        return {
          text: t('weekSummary.suggestionConflicts', { n: s.n }),
          action: () => router.push('/month'),
        };
      default:
        return { text: t('weekSummary.suggestionLight'), action: () => router.push('/planner') };
    }
  };

  return (
    <Screen>
      {/* O título fica no corpo da tela, ao lado do símbolo; a barra fica limpa. */}
      <Stack.Screen options={{ title: '' }} />
      <View style={styles.hero}>
        <View style={styles.flex}>
          <AppText variant="overline" tone="muted">
            {t('weekSummary.period', { start: formatShortDate(days[0]), end: formatShortDate(days[6]) })}
          </AppText>
          <AppText variant="title" accessibilityRole="header">
            {t('weekSummary.title')}
          </AppText>
        </View>
        <GlassSphere size={72} paused={!focused} />
      </View>
      <View style={styles.stats}>
        <Stat icon="calendar-outline" label={t('weekSummary.events')} value={String(summary.events.length)} />
        <Stat
          icon="flag-outline"
          label={t('weekSummary.deadlines')}
          value={String(summary.deadlines.length)}
        />
        <Stat icon="time-outline" label={t('weekSummary.free')} value={`${hours} h`} />
        <Stat icon="group-outline" label={t('weekSummary.shared')} value={String(summary.shared.length)} />
      </View>

      <SectionHeader title={t('weekSummary.suggestions')} />
      {summary.suggestions.length === 0 ? (
        <AppText tone="muted">{t('weekSummary.nothing')}</AppText>
      ) : (
        summary.suggestions.map((s, i) => {
          const { text, action } = suggestion(s);
          return (
            <EnterItem key={s.key} index={i}>
              <Card onPress={action} accessibilityLabel={text} style={styles.suggestion}>
                <Icon name="sparkles-outline" size={20} color={colors.primaryInk} />
                <AppText style={styles.flex}>{text}</AppText>
              </Card>
            </EnterItem>
          );
        })
      )}

      <SectionHeader title={t('weekSummary.deadlines')} />
      {summary.deadlines.length === 0 ? (
        <AppText tone="muted">{t('weekSummary.nothing')}</AppText>
      ) : (
        summary.deadlines.slice(0, 12).map((task) => (
          <Card
            key={task.id}
            onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
            style={styles.line}
          >
            <AppText style={styles.flex} numberOfLines={1}>
              {task.title}
            </AppText>
            <AppText variant="caption" tone="muted">
              {describeDue(task, today, display.timeFormat)}
            </AppText>
          </Card>
        ))
      )}

      {summary.overdue.length > 0 && (
        <>
          <SectionHeader title={t('weekSummary.overdue')} />
          {summary.overdue.slice(0, 8).map((task) => (
            <Card
              key={task.id}
              onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
              style={styles.line}
            >
              <AppText style={styles.flex} numberOfLines={1}>
                {task.title}
              </AppText>
              <AppText variant="caption" tone="muted">
                {describeDue(task, today)}
              </AppText>
            </Card>
          ))}
        </>
      )}

      {summary.shared.length > 0 && (
        <>
          <SectionHeader title={t('weekSummary.shared')} />
          {summary.shared.slice(0, 8).map((o) => (
            <Card
              key={o.key}
              onPress={() =>
                router.push({ pathname: '/event/[id]', params: { id: o.event.id, date: o.originalDate } })
              }
              style={styles.line}
            >
              <AppText style={styles.flex} numberOfLines={1}>
                {o.event.is_masked ? t('events.maskedTitle') : o.title}
              </AppText>
              <AppText variant="caption" tone="muted">
                {`${capitalize(formatLongDate(o.startDate ?? toDateKey(o.start, display.timezone)).split(',')[0])} ${o.allDay ? '' : formatTime(o.start, display.timezone, display.timeFormat)}`.trim()}
              </AppText>
            </Card>
          ))}
        </>
      )}
      <Button
        title={t('weekSummary.openPlanner')}
        icon="sparkles-outline"
        onPress={() => router.push('/planner')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
});
