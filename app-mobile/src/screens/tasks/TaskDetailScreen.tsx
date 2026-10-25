// Detalhes de uma tarefa ou lembrete: conclusão, etapas com progresso,
// prazo e repetição, blocos de tempo no calendário, comentários e histórico.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EventRow } from '@/components/EventRow';
import { useFeedback } from '@/components/Feedback';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { OptionSheet } from '@/components/OptionSheet';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/StateViews';
import { TaskCheck } from '@/components/TaskRow';
import { TextField } from '@/components/TextField';
import { useAction } from '@/hooks/useAction';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useCalendarsMap, useOccurrences } from '@/hooks/useEventsView';
import { useLists, useTask } from '@/hooks/useItems';
import { useNow } from '@/hooks/useNow';
import { usePeople } from '@/hooks/usePeople';
import { useRemoteData } from '@/hooks/useRemoteData';
import { useTaskActions } from '@/hooks/useTaskActions';
import { strings, t, tDynamic } from '@/i18n';
import type { ChecklistItem, Occurrence, Task } from '@/models/types';
import * as api from '@/services/api';
import {
  addStep,
  completeTask,
  deleteStep,
  deleteTask,
  moveStep,
  postponeTask,
  setTaskPlan,
  toggleStep,
} from '@/services/itemActions';
import { goBack } from '@/services/navigation';
import { useUserId } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { motion, radius, spacing } from '@/theme/tokens';
import {
  addDaysToKey,
  formatDateKey,
  formatDateTime,
  formatShortDate,
  todayKey,
  weekdayOfKey,
} from '@/utils/dates';
import { canCreateEvents } from '@/utils/permissions';
import { describeRule, parseRule } from '@/utils/recurrence';
import { reminderLabel } from '@/utils/reminders';
import { checklistProgress, describeDue, isOpen, isOverdue, priorityMarks } from '@/utils/tasks';

import { estimateLabel } from './TaskFormScreen';

/** Barra de progresso das etapas: cresce com mola a cada etapa concluída. */
function ProgressBar({ value }: { value: number }) {
  const { colors, reduceMotion } = useAppTheme();
  const progress = useSharedValue(value);
  useEffect(() => {
    progress.value = reduceMotion ? withTiming(value, { duration: 120 }) : withSpring(value, motion.mola);
  }, [value, reduceMotion, progress]);
  const style = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, progress.value)) * 100}%` }));
  return (
    <View
      style={[styles.track, { backgroundColor: colors.surfaceAlt }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <Animated.View style={[styles.fill, { backgroundColor: colors.primary }, style]} />
    </View>
  );
}

function Checklist({ task, canEdit, canTick }: { task: Task; canEdit: boolean; canTick: boolean }) {
  const { colors } = useAppTheme();
  const { confirm, toast } = useFeedback();
  const [text, setText] = useState('');
  const progress = checklistProgress(task);
  const asked = useRef(false);

  const tick = async (item: ChecklistItem) => {
    await toggleStep(task, item);
    const willAllBeDone = !item.done && progress.done + 1 === progress.total;
    if (willAllBeDone && isOpen(task) && !asked.current) {
      asked.current = true;
      // A tarefa principal não é concluída sozinha: a pessoa confirma.
      const ok = await confirm({ title: t('tasks.checklistAllDone'), confirmLabel: t('tasks.complete') });
      if (ok) {
        await completeTask(task);
        toast(t('tasks.completed'), 'success');
      }
    }
  };

  const add = () => {
    if (!text.trim()) return;
    void addStep(task, text);
    setText('');
  };

  return (
    <View style={styles.gap}>
      <SectionHeader
        title={t('tasks.checklist')}
        right={
          progress.total ? (
            <AppText variant="caption" tone="muted">
              {t('tasks.checklistProgress', { done: progress.done, total: progress.total })}
            </AppText>
          ) : undefined
        }
      />
      {progress.total > 0 && <ProgressBar value={progress.done / progress.total} />}
      {task.checklist.map((item, i) => (
        <View key={item.id} style={[styles.stepRow, { borderBottomColor: colors.border }]}>
          <TaskCheck
            done={item.done}
            priority={0}
            label={
              item.done ? `${t('tasks.reopen')}: ${item.title}` : `${t('tasks.complete')}: ${item.title}`
            }
            onPress={() => void tick(item)}
            disabled={!canTick}
          />
          <AppText
            style={[
              styles.flex,
              item.done && { textDecorationLine: 'line-through', color: colors.textMuted },
            ]}
          >
            {item.title}
          </AppText>
          {canEdit && (
            <>
              <IconButton
                icon="chevron-up"
                label={`${t('tasks.moveUp')}: ${item.title}`}
                disabled={i === 0}
                onPress={() => void moveStep(task, item, -1)}
              />
              <IconButton
                icon="chevron-down"
                label={`${t('tasks.moveDown')}: ${item.title}`}
                disabled={i === task.checklist.length - 1}
                onPress={() => void moveStep(task, item, 1)}
              />
              <IconButton
                icon="close"
                label={`${t('tasks.removeStep')}: ${item.title}`}
                onPress={() => void deleteStep(task, item)}
              />
            </>
          )}
        </View>
      ))}
      {canEdit && (
        <View style={styles.addRow}>
          <View style={styles.flex}>
            <TextField
              label={t('tasks.checklistAdd')}
              placeholder={t('tasks.checklistPlaceholder')}
              value={text}
              onChangeText={setText}
              onSubmitEditing={add}
              returnKeyType="done"
              maxLength={200}
            />
          </View>
          <IconButton
            icon="add"
            label={t('tasks.checklistAdd')}
            onPress={add}
            disabled={!text.trim()}
            filled
          />
        </View>
      )}
    </View>
  );
}

function Comments({ task, canWrite }: { task: Task; canWrite: boolean }) {
  const display = useDisplaySettings();
  const online = useSyncStore((s) => s.online);
  const { run, busy } = useAction();
  const { confirm } = useFeedback();
  const [text, setText] = useState('');
  const isPending = task.version === 0;
  const { data, reload } = useRemoteData(
    () => (online && !isPending ? api.listTaskComments(task.id) : Promise.resolve([])),
    [task.id, online, isPending],
    [],
  );
  const send = async () => {
    const body = text.trim();
    if (!body) return;
    const result = await run(() => api.addTaskComment(task.id, body));
    if (result.ok) {
      setText('');
      void reload();
    }
  };
  const remove = async (id: string) => {
    const ok = await confirm({
      title: t('events.deleteComment'),
      destructive: true,
      confirmLabel: t('common.delete'),
    });
    if (ok && (await run(() => api.deleteTaskComment(id))).ok) void reload();
  };
  return (
    <View style={styles.gap}>
      <SectionHeader title={t('tasks.comments')} />
      {!online ? <AppText tone="muted">{t('events.commentsOffline')}</AppText> : null}
      {online && !data?.length ? <AppText tone="muted">{t('events.noComments')}</AppText> : null}
      {data?.map((c) => (
        <Card key={c.id}>
          <View style={styles.inline}>
            <Avatar name={c.author_name} color={c.author_color} size={28} />
            <View style={styles.flex}>
              <AppText variant="label">{c.is_mine ? t('common.you') : c.author_name}</AppText>
              <AppText variant="caption" tone="muted">
                {formatDateTime(
                  new Date(c.created_at),
                  display.timezone,
                  display.dateFormat,
                  display.timeFormat,
                )}
              </AppText>
            </View>
            {c.is_mine && !c.deleted_at && (
              <IconButton
                icon="trash-outline"
                label={t('events.deleteComment')}
                onPress={() => void remove(c.id)}
              />
            )}
          </View>
          <AppText tone={c.deleted_at ? 'muted' : 'default'} selectable>
            {c.deleted_at ? t('events.commentDeleted') : c.body}
          </AppText>
        </Card>
      ))}
      {canWrite && online && !isPending && (
        <>
          <TextField
            label={t('events.commentPlaceholder')}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
          />
          <Button title={t('events.send')} icon="send" onPress={send} loading={busy} compact />
        </>
      )}
    </View>
  );
}

function History({ task }: { task: Task }) {
  const { colors } = useAppTheme();
  const display = useDisplaySettings();
  const online = useSyncStore((s) => s.online);
  const { data } = useRemoteData(
    () => (online && task.version > 0 ? api.listTaskHistory(task.id) : Promise.resolve([])),
    [task.id, online, task.version],
    [],
  );
  if (!online) return null;
  return (
    <View style={styles.gap}>
      <SectionHeader title={t('tasks.history')} />
      {!data?.length ? <AppText tone="muted">{t('tasks.historyEmpty')}</AppText> : null}
      {data?.slice(0, 30).map((h, i) => (
        <View key={`${h.at}-${i}`} style={styles.historyRow}>
          <Icon
            name={h.kind === 'completion' ? 'checkmark-circle-outline' : 'time-outline'}
            size={16}
            color={colors.textMuted}
          />
          <View style={styles.flex}>
            <AppText variant="small">
              {h.kind === 'completion'
                ? t('activity.items.completion', {
                    actor: h.actor_name,
                    date: h.occurrence_date ? formatDateKey(h.occurrence_date, display.dateFormat) : '',
                  })
                : tDynamic(`activity.items.${h.action}`, { actor: h.actor_name })}
            </AppText>
            <AppText variant="caption" tone="muted">
              {formatDateTime(new Date(h.at), display.timezone, display.dateFormat, display.timeFormat)}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useTask(id);
  const { colors } = useAppTheme();
  const display = useDisplaySettings();
  const userId = useUserId();
  const { toast, confirm } = useFeedback();
  const calendars = useCalendarsMap();
  const lists = useLists();
  const people = usePeople();
  const { toggle } = useTaskActions();
  const [postponeOpen, setPostponeOpen] = useState(false);
  const today = todayKey(display.timezone);

  // Blocos de tempo: eventos ligados a esta tarefa nos próximos 60 dias.
  const now = useNow(5 * 60_000);
  const occurrences = useOccurrences(new Date(now - 7 * 86_400_000), new Date(now + 60 * 86_400_000));
  const blocks = useMemo(
    () => occurrences.filter((o: Occurrence) => o.event.task_id === id && o.end.getTime() > now),
    [occurrences, id, now],
  );

  if (!task) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('tasks.details') }} />
        <EmptyState icon="alert-circle-outline" title={t('tasks.notFound')} />
      </Screen>
    );
  }

  const calendar = task.calendar_id ? calendars[task.calendar_id] : undefined;
  const list = task.list_id ? lists.find((l) => l.id === task.list_id) : undefined;
  const canEdit = calendar
    ? calendar.status === 'active' &&
      (['owner', 'admin'].includes(calendar.my_role) ||
        (calendar.my_role === 'editor' && (calendar.editors_can_edit_all || task.created_by === userId)) ||
        (calendar.my_role === 'collaborator' && task.created_by === userId))
    : task.created_by === userId;
  const canTick = canEdit || task.assignee_id === userId;
  const canComment =
    !!calendar && (canTick || ['owner', 'admin', 'editor', 'collaborator'].includes(calendar.my_role));
  const open = isOpen(task);
  const late = isOverdue(task, today);
  const rule = parseRule(task.recurrence_rule);
  const due = describeDue(task, today, display.timeFormat);
  const reminder = task.item_type === 'reminder';

  const remove = async () => {
    const ok = await confirm({
      title: reminder ? t('tasks.deleteReminderTitle') : t('tasks.deleteTitle'),
      message: t('tasks.deleteMessage'),
      destructive: true,
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    await deleteTask(task);
    toast(t('tasks.deleted'));
    goBack();
  };

  const postpone = async (choice: 'tomorrow' | 'nextWeek' | 'pick') => {
    setPostponeOpen(false);
    if (choice === 'pick') {
      router.push({ pathname: '/task/[id]/edit', params: { id: task.id } });
      return;
    }
    const day =
      choice === 'tomorrow'
        ? addDaysToKey(today, 1)
        : addDaysToKey(today, (8 - weekdayOfKey(today)) % 7 || 7);
    await postponeTask(task, day);
    toast(t('tasks.postponed', { date: formatShortDate(day) }));
  };

  const assignee = task.assignee_id ? people[task.assignee_id] : undefined;
  const writableCalendar = Object.values(calendars).some((c) => canCreateEvents(c));

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: reminder ? t('tasks.reminderDetails') : t('tasks.details'),
          headerRight: canEdit
            ? () => (
                <View style={styles.inline}>
                  <IconButton
                    icon="create-outline"
                    label={t('common.edit')}
                    onPress={() => router.push({ pathname: '/task/[id]/edit', params: { id: task.id } })}
                  />
                  <IconButton icon="trash-outline" label={t('common.delete')} onPress={() => void remove()} />
                </View>
              )
            : undefined,
        }}
      />
      <View style={styles.hero}>
        <TaskCheck
          done={!open}
          priority={task.priority}
          reminder={reminder}
          label={open ? `${t('tasks.complete')}: ${task.title}` : `${t('tasks.reopen')}: ${task.title}`}
          onPress={() => void toggle(task)}
          disabled={!canTick}
        />
        <AppText
          variant="title"
          selectable
          style={[styles.flex, !open && { textDecorationLine: 'line-through', color: colors.textMuted }]}
          accessibilityRole="header"
        >
          {task.title}
        </AppText>
      </View>
      <View style={styles.badges}>
        <Badge label={strings.tasks.statuses[task.status]} tone={open ? 'neutral' : 'success'} />
        {task.priority > 0 && (
          <Badge
            label={`${strings.tasks.priorities[task.priority]} ${priorityMarks(task.priority)}`.trim()}
            tone={task.priority >= 3 ? 'warning' : 'primary'}
            icon="flag-outline"
          />
        )}
        {late && <Badge label={t('tasks.overdue')} tone="danger" icon="alert-circle-outline" />}
        {task.plan_day === today && (
          <Badge label={t('planDay.inMyDay')} tone="primary" icon="sunny-outline" />
        )}
        {task.pending && <Badge label={t('tasks.pendingBadge')} icon="cloud-upload-outline" />}
      </View>
      {!canEdit && (
        <AppText variant="small" tone="muted">
          {t('tasks.readOnly')}
        </AppText>
      )}

      {canTick && (
        <View style={styles.actions}>
          <Button
            title={open ? t('tasks.complete') : t('tasks.reopen')}
            icon={open ? 'checkmark' : 'arrow-undo-outline'}
            onPress={() => void toggle(task)}
            compact
          />
          {open && (
            <Button
              title={task.plan_day === today ? t('tasks.planRemove') : t('tasks.planToday')}
              icon="sunny-outline"
              variant="tonal"
              compact
              onPress={() => void setTaskPlan(task, task.plan_day === today ? null : today)}
            />
          )}
          {open && canEdit && (
            <Button
              title={t('tasks.postpone')}
              icon="snooze-outline"
              variant="tonal"
              compact
              onPress={() => setPostponeOpen(true)}
            />
          )}
          {open && !reminder && writableCalendar && (
            <Button
              title={t('tasks.reserveTime')}
              icon="calendar-outline"
              variant="tonal"
              compact
              onPress={() => router.push({ pathname: '/task/[id]/block', params: { id: task.id } })}
            />
          )}
        </View>
      )}

      <Card>
        <View style={styles.infoRow}>
          <Icon
            name={late ? 'alert-circle-outline' : 'time-outline'}
            size={18}
            color={late ? colors.danger : colors.textMuted}
          />
          <View style={styles.flex}>
            <AppText variant="label">{reminder ? t('tasks.reminderDate') : t('tasks.due')}</AppText>
            <AppText tone={late ? 'danger' : 'default'}>
              {due
                ? `${due}${task.due_date ? ` · ${formatDateKey(task.due_date, display.dateFormat)}` : ''}`
                : t('tasks.noDue')}
            </AppText>
          </View>
        </View>
        {rule && task.due_date && (
          <View style={styles.infoRow}>
            <Icon name="repeat" size={18} color={colors.textMuted} />
            <AppText style={styles.flex}>
              {task.recurrence_mode === 'completion'
                ? t('tasks.afterCompletion', { rule: describeRule(rule, task.due_date) })
                : describeRule(rule, task.due_date)}
            </AppText>
          </View>
        )}
        {task.my_alerts.length > 0 && task.due_date && (
          <View style={styles.infoRow}>
            <Icon name="notifications-outline" size={18} color={colors.textMuted} />
            <AppText style={styles.flex}>
              {task.my_alerts.map((m) => (m === 0 ? t('tasks.alertAtDue') : reminderLabel(m))).join(', ')}
            </AppText>
          </View>
        )}
        {task.estimated_minutes ? (
          <View style={styles.infoRow}>
            <Icon name="time-outline" size={18} color={colors.textMuted} />
            <AppText
              style={styles.flex}
            >{`${t('tasks.estimate')}: ${estimateLabel(task.estimated_minutes)}`}</AppText>
          </View>
        ) : null}
        <View style={styles.infoRow}>
          <Icon name="list-outline" size={18} color={colors.textMuted} />
          <AppText style={styles.flex}>{list ? list.name : t('tasks.noList')}</AppText>
        </View>
        <View style={styles.infoRow}>
          <Icon
            name={calendar ? 'group-outline' : 'lock-closed-outline'}
            size={18}
            color={colors.textMuted}
          />
          <AppText style={styles.flex}>
            {calendar
              ? `${calendar.name} · ${strings.tasks.privacyOptions[task.privacy]}`
              : t('tasks.personal')}
          </AppText>
        </View>
        {assignee && (
          <View style={styles.infoRow}>
            <Avatar name={assignee.name} color={assignee.color} size={22} />
            <AppText style={styles.flex}>
              {assignee.isMe ? t('tasks.assignedToMe') : t('tasks.assignedTo', { name: assignee.name })}
            </AppText>
          </View>
        )}
        {task.tags.length > 0 && (
          <View style={styles.infoRow}>
            <Icon name="pricetag-outline" size={18} color={colors.textMuted} />
            <AppText style={styles.flex}>{task.tags.map((x) => `#${x}`).join('  ')}</AppText>
          </View>
        )}
      </Card>

      {task.description ? <AppText selectable>{task.description}</AppText> : null}
      {task.links.map((link) => (
        <Button
          key={link}
          title={link}
          icon="link-outline"
          variant="ghost"
          compact
          onPress={() => void Linking.openURL(link)}
        />
      ))}

      {!reminder && <Checklist task={task} canEdit={canEdit} canTick={canTick} />}

      {!reminder && (
        <View style={styles.gap}>
          <SectionHeader title={t('tasks.blocks')} />
          {blocks.length === 0 ? (
            <AppText variant="small" tone="muted">
              {t('tasks.noBlocks')}
            </AppText>
          ) : (
            blocks.map((o) => (
              <EventRow
                key={o.key}
                occurrence={o}
                calendarName={calendars[o.event.calendar_id]?.name}
                calendarColor={calendars[o.event.calendar_id]?.color}
                timezone={display.timezone}
                timeFormat={display.timeFormat}
                dateFormat={display.dateFormat}
                showDate
                onPress={(occ) =>
                  router.push({
                    pathname: '/event/[id]',
                    params: { id: occ.event.id, date: occ.originalDate },
                  })
                }
              />
            ))
          )}
        </View>
      )}

      {calendar && <Comments task={task} canWrite={canComment} />}
      <History task={task} />

      <OptionSheet<'tomorrow' | 'nextWeek' | 'pick' | null>
        visible={postponeOpen}
        title={t('tasks.postpone')}
        options={[
          { value: 'tomorrow', label: t('tasks.postponeTomorrow') },
          { value: 'nextWeek', label: t('tasks.postponeNextWeek') },
          { value: 'pick', label: t('tasks.postponePick') },
        ]}
        value={null}
        onSelect={(v) => v && void postpone(v)}
        onClose={() => setPostponeOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: spacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.pill },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 2,
  },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  historyRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
