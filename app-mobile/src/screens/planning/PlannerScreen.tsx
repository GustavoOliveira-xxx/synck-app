import { RoutineCancelled } from '@/services/routineGuard';
// "Planejar minha semana": sugere blocos de tempo para as tarefas com prazo
// nos próximos dias, explica cada sugestão e só reserva depois da revisão.
import { Stack } from 'expo-router';
import { router } from '@/services/router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { Icon } from '@/components/Icon';
import { EnterItem } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { SelectField } from '@/components/SelectField';
import { EmptyState } from '@/components/StateViews';
import { TaskCheck } from '@/components/TaskRow';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useTasks } from '@/hooks/useItems';
import { useNow } from '@/hooks/useNow';
import { useFreeSlots } from '@/hooks/usePlanning';
import { strings, t } from '@/i18n';
import { reservePlan, deleteEventsById } from '@/services/eventActions';
import { goBack } from '@/services/navigation';
import { useDataStore } from '@/stores/dataStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import {
  addDaysToKey,
  capitalize,
  formatLongDate,
  formatShortDate,
  formatTime,
  instantToLocal,
  todayKey,
} from '@/utils/dates';
import { canCreateEvents } from '@/utils/permissions';
import { planWeek, executionWindow, type BlockSuggestion, type PlanReason } from '@/utils/planner';
import { describeDue } from '@/utils/tasks';
import { newEventForm } from '@/validation/event';

const DAYS = 7;

function reasonText(r: PlanReason, today: string): string {
  switch (r.key) {
    case 'deadline':
      return t('planner.reasonDeadline', {
        when:
          describeDue(
            { due_date: String(r.value), due_time: null, status: 'pending', timezone: 'UTC' },
            today,
          )?.toLowerCase() ?? formatShortDate(String(r.value)),
      });
    case 'overdue':
      return t('tasks.overdue').toLowerCase();
    case 'priority':
      return t('planner.reasonPriority', {
        priority: strings.tasks.priorities[Number(r.value) as 0].toLowerCase(),
      });
    case 'split':
      return t('planner.reasonSplit', { n: Number(r.value) });
    default:
      return t('planner.reasonFree');
  }
}

export default function PlannerScreen() {
  const { colors } = useAppTheme();
  const display = useDisplaySettings();
  const { toast } = useFeedback();
  const tasks = useTasks();
  const calendars = useDataStore((s) => s.calendars).filter((c) => canCreateEvents(c));
  const today = todayKey(display.timezone);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDaysToKey(today, i)), [today]);
  const { slots, occurrences, complete } = useFreeSlots(days, 15);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [calendarId, setCalendarId] = useState(
    calendars.find((c) => c.kind === 'personal')?.id ?? calendars[0]?.id ?? '',
  );
  const [saving, setSaving] = useState(false);

  // Tempo já reservado para cada tarefa em blocos futuros.
  const now = useNow(5 * 60_000);
  const reserved = useMemo(() => {
    const map: Record<string, number> = {};
    const byId = new Map(tasks.map((task) => [task.id, task]));
    for (const o of occurrences) {
      if (!o.event.task_id || o.end.getTime() < now) continue;
      const task = byId.get(o.event.task_id);
      if (!task || ['cancelled', 'archived'].includes(o.event.status)) continue;
      if (
        task.recurrence_rule &&
        o.event.task_occurrence_date &&
        o.event.task_occurrence_date !== task.due_date
      )
        continue;
      const window = executionWindow(task);
      const minutes =
        Math.max(0, Math.min(+o.end, window.end) - Math.max(+o.start, now, window.start)) / 60_000;
      map[task.id] = (map[task.id] ?? 0) + Math.floor(minutes);
    }
    return map;
  }, [occurrences, now, tasks]);

  const plan = useMemo(
    () =>
      planWeek({ tasks, slots: complete ? slots : [], lastDay: days[DAYS - 1], today, reserved, excluded }),
    [tasks, slots, complete, days, today, reserved, excluded],
  );
  const chosen = plan.suggestions.filter((s) => !skipped.includes(s.id));

  const needsPrivate = chosen.some((s) => s.task.calendar_id !== calendarId || s.task.privacy !== 'members');
  const privateBlocked = needsPrivate && !calendars.find((c) => c.id === calendarId)?.allow_private_events;
  const byDay = new Map<string, BlockSuggestion[]>();
  for (const s of plan.suggestions) {
    const day = instantToLocal(s.start, display.timezone).dateKey;
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }

  const reserve = async () => {
    if (!calendarId || privateBlocked || !chosen.length) return;
    setSaving(true);
    try {
      const entries = chosen.map((s) => {
        const start = instantToLocal(s.start, display.timezone);
        const end = instantToLocal(s.end, display.timezone);
        const base = newEventForm(calendarId, display.timezone, start.dateKey);
        return {
          taskId: s.task.id,
          form: {
            ...base,
            title: s.parts > 1 ? `${s.task.title} (${s.part}/${s.parts})` : s.task.title,
            startDate: start.dateKey,
            startTime: start.time.slice(0, 5),
            endDate: end.dateKey,
            endTime: end.time.slice(0, 5),
            eventType: 'custom' as const,
            privacy:
              s.task.calendar_id === calendarId && s.task.privacy === 'members'
                ? ('members' as const)
                : ('private' as const),
            reminders: [],
          },
        };
      });
      const created = await reservePlan(entries);
      toast(t('planner.reserved', { n: created.length }), 'success', {
        label: t('planner.undo'),
        onPress: () => void deleteEventsById(created).then(() => toast(t('planner.undone'))),
      });
      goBack();
    } catch (error) {
      if (!(error instanceof RoutineCancelled))
        toast('Não foi possível reservar o plano. Confira a sincronização.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const candidates = tasks.filter(
    (x) =>
      x.item_type === 'task' &&
      x.status !== 'done' &&
      x.status !== 'cancelled' &&
      x.due_date &&
      x.due_date <= days[DAYS - 1],
  );

  return (
    <Screen
      footer={
        chosen.length ? (
          <Button
            title={t('planner.reserve', { n: chosen.length })}
            icon="calendar-outline"
            onPress={() => void reserve()}
            loading={saving}
            disabled={!calendarId || privateBlocked}
          />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: t('planner.title') }} />
      <AppText>{t('planner.intro')}</AppText>
      <AppText variant="small" tone="muted">
        {`${t('planner.window', { start: display.dayStart, end: display.dayEnd })} · ${t('planner.days', { n: DAYS })}`}
      </AppText>
      <Button
        title={t('planner.changeWindow')}
        variant="ghost"
        compact
        icon="settings-outline"
        onPress={() => router.push('/settings/preferences')}
      />

      {candidates.length === 0 ? (
        <EmptyState art="sphere" title={t('planner.noTasks')} message={t('planner.noTasksHint')} />
      ) : (
        <>
          <SectionHeader title={t('planner.include')} />
          {candidates.map((task) => {
            const on = !excluded.includes(task.id);
            return (
              <View key={task.id} style={styles.row}>
                <TaskCheck
                  done={on}
                  priority={task.priority}
                  label={`${t('planner.include')}: ${task.title}`}
                  onPress={() => setExcluded((x) => (on ? [...x, task.id] : x.filter((y) => y !== task.id)))}
                />
                <View style={styles.flex}>
                  <AppText numberOfLines={1}>{task.title}</AppText>
                  <AppText variant="caption" tone="muted">
                    {[
                      describeDue(task, today, display.timeFormat),
                      task.estimated_minutes
                        ? t('tasks.estimateMinutes', { n: task.estimated_minutes })
                        : t('planner.defaultDuration'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </AppText>
                </View>
              </View>
            );
          })}

          <SectionHeader title={t('planner.suggestions')} />
          {!complete && <AppText tone="muted">Sincronize a agenda para conferir os horários livres.</AppText>}
          {chosen.some((s) => s.task.calendar_id !== calendarId || s.task.privacy !== 'members') && (
            <AppText tone="muted">
              Blocos de tarefas pessoais ou de outra agenda ficam visíveis só para você.
            </AppText>
          )}
          {[...byDay.entries()].map(([day, list]) => (
            <View key={day} style={styles.gap}>
              <AppText variant="overline" tone="muted">
                {capitalize(formatLongDate(day))}
              </AppText>
              {list.map((s, i) => {
                const on = !skipped.includes(s.id);
                return (
                  <EnterItem key={s.id} index={i}>
                    <Card style={[styles.suggestion, !on && { opacity: 0.55 }]}>
                      <TaskCheck
                        done={on}
                        priority={s.task.priority}
                        label={`${t('planner.include')}: ${s.task.title}`}
                        onPress={() => setSkipped((x) => (on ? [...x, s.id] : x.filter((y) => y !== s.id)))}
                      />
                      <View style={styles.flex}>
                        <AppText variant="time" style={{ color: colors.primaryInk }}>
                          {`${formatTime(s.start, display.timezone, display.timeFormat)} a ${formatTime(s.end, display.timezone, display.timeFormat)}`}
                        </AppText>
                        <AppText variant="bodyMd">
                          {s.parts > 1 ? `${s.task.title} (${s.part}/${s.parts})` : s.task.title}
                        </AppText>
                        <View style={styles.reason}>
                          <Icon name="sparkles-outline" size={13} color={colors.textMuted} />
                          <AppText variant="caption" tone="muted" style={styles.flex}>
                            {`${t('planner.reason')}: ${s.reasons.map((r) => reasonText(r, today)).join(', ')}`}
                          </AppText>
                        </View>
                      </View>
                    </Card>
                  </EnterItem>
                );
              })}
            </View>
          ))}
          {plan.unplaced.length > 0 && (
            <Card style={styles.gap}>
              <AppText variant="label" tone="warning">
                {t('planner.unplaced')}
              </AppText>
              {plan.unplaced.map((task) => (
                <AppText key={task.id} variant="small">{`• ${task.title}`}</AppText>
              ))}
              <AppText variant="caption" tone="muted">
                {t('planner.unplacedHint')}
              </AppText>
            </Card>
          )}
          {privateBlocked && (
            <AppText tone="warning">Selecione uma agenda que permita blocos privados.</AppText>
          )}
          {calendars.length > 0 ? (
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
          ) : (
            <AppText tone="danger">{t('planner.noPersonal')}</AppText>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  suggestion: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
});
