import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { strings, t } from '@/i18n';
import type { DateKey, Task, TimeFormat } from '@/models/types';
import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, fonte, MIN_TOUCH, motion, radius, spacing } from '@/theme/tokens';
import { checklistProgress, describeDue, isOpen, isOverdue, priorityMarks } from '@/utils/tasks';

import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { PressableScale, tapFeedback } from './motion';

export interface TaskRowProps {
  task: Task;
  today: DateKey;
  timeFormat?: TimeFormat;
  calendarName?: string;
  calendarColor?: string;
  listName?: string;
  assignee?: { name: string; color: string; isMe: boolean } | null;
  onPress: (task: Task) => void;
  onToggle: (task: Task) => void;
  /** Menu de ações rápidas (toque longo). */
  onLongPress?: (task: Task) => void;
  /** Esconde a lista (quando a tela já é a da lista). */
  hideList?: boolean;
  compact?: boolean;
}

/** Cor da borda da caixa de conclusão: acompanha a prioridade (com marca em texto ao lado). */
function usePriorityColor(priority: number) {
  const { colors } = useAppTheme();
  if (priority >= 4) return colors.coral;
  if (priority === 3) return colors.warning;
  if (priority === 2) return colors.primary;
  return colors.inputBorder;
}

/** Caixa de conclusão: o ✓ entra com mola e a caixa dá um pulo curto. */
export function TaskCheck({
  done,
  priority,
  reminder,
  label,
  onPress,
  disabled,
}: {
  done: boolean;
  priority: number;
  reminder?: boolean;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors, reduceMotion } = useAppTheme();
  const border = usePriorityColor(priority);
  const fill = useSharedValue(done ? 1 : 0);
  const pop = useSharedValue(1);
  useEffect(() => {
    fill.value = reduceMotion
      ? withTiming(done ? 1 : 0, { duration: 120 })
      : withSpring(done ? 1 : 0, motion.mola);
  }, [done, reduceMotion, fill]);
  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: fill.value > 0.5 ? colors.primary : 'transparent',
    transform: [{ scale: pop.value }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.5 + 0.5 * fill.value }],
  }));
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        tapFeedback(done ? 'light' : 'success');
        if (!reduceMotion)
          pop.set(withSequence(withTiming(0.86, { duration: 80 }), withSpring(1, motion.mola)));
        onPress();
      }}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled }}
      accessibilityLabel={label}
      style={styles.checkTouch}
    >
      <Animated.View
        style={[
          styles.check,
          reminder ? styles.checkReminder : null,
          { borderColor: done ? colors.primary : border },
          boxStyle,
        ]}
      >
        <Animated.View style={checkStyle}>
          <Icon name="checkmark" size={16} color={colors.primaryText} strokeWidth={2.6} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export const TaskRow = memo(function TaskRow({
  task,
  today,
  timeFormat,
  calendarName,
  calendarColor,
  listName,
  assignee,
  onPress,
  onToggle,
  onLongPress,
  hideList,
  compact,
}: TaskRowProps) {
  const { colors, dark } = useAppTheme();
  const done = !isOpen(task);
  const late = isOverdue(task, today);
  const due = describeDue(task, today, timeFormat);
  const progress = checklistProgress(task);
  const marks = priorityMarks(task.priority);
  const priorityColor = usePriorityColor(task.priority);
  const agenda = agendaColor(calendarColor, dark);

  const meta: string[] = [];
  if (due) meta.push(due);
  if (progress.total) meta.push(t('tasks.checklistProgress', { done: progress.done, total: progress.total }));
  if (!hideList && listName) meta.push(listName);
  if (calendarName) meta.push(calendarName);
  const hasMeta = meta.length > 0 || !!task.recurrence_rule || task.tags.length > 0;
  const a11y = [
    task.item_type === 'reminder' ? strings.create.reminder : strings.create.task,
    task.title,
    done ? strings.tasks.statuses[task.status] : late ? strings.tasks.overdue : '',
    task.priority ? strings.tasks.priorities[task.priority] : '',
    ...meta,
    task.recurrence_rule ? strings.tasks.recurring : '',
    assignee
      ? assignee.isMe
        ? strings.tasks.assignedToMe
        : t('tasks.assignedTo', { name: assignee.name })
      : '',
    task.pending ? strings.tasks.pendingBadge : '',
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <PressableScale
      onPress={() => onPress(task)}
      onLongPress={onLongPress ? () => onLongPress(task) : undefined}
      delayLongPress={350}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityActions={onLongPress ? [{ name: 'longpress', label: t('tasks.postpone') }] : undefined}
      onAccessibilityAction={onLongPress ? () => onLongPress(task) : undefined}
      style={[
        styles.row,
        !hasMeta && styles.centered,
        compact && styles.compact,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <TaskCheck
        done={done}
        priority={task.priority}
        reminder={task.item_type === 'reminder'}
        label={done ? `${t('tasks.reopen')}: ${task.title}` : `${t('tasks.complete')}: ${task.title}`}
        onPress={() => onToggle(task)}
      />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          {task.item_type === 'reminder' && (
            <Icon name="notifications-outline" size={15} color={colors.textMuted} />
          )}
          <AppText
            variant="bodyMd"
            numberOfLines={2}
            style={[styles.title, done && { textDecorationLine: 'line-through', color: colors.textMuted }]}
          >
            {task.title}
          </AppText>
        </View>
        {hasMeta && (
          <View style={styles.meta}>
            {due && (
              <View style={styles.metaItem}>
                <Icon
                  name={late ? 'alert-circle-outline' : 'time-outline'}
                  size={13}
                  color={late ? colors.danger : colors.textMuted}
                />
                <AppText variant="caption" style={{ color: late ? colors.danger : colors.textMuted }}>
                  {due}
                </AppText>
              </View>
            )}
            {task.recurrence_rule && <Icon name="repeat" size={13} color={colors.textMuted} />}
            {progress.total > 0 && (
              <View style={styles.metaItem}>
                <Icon name="checkmark-done-outline" size={13} color={colors.textMuted} />
                <AppText variant="caption" tone="muted">
                  {`${progress.done}/${progress.total}`}
                </AppText>
              </View>
            )}
            {!hideList && listName && (
              <View style={styles.metaItem}>
                <Icon name="list-outline" size={13} color={colors.textMuted} />
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {listName}
                </AppText>
              </View>
            )}
            {calendarName && (
              <View style={styles.metaItem}>
                <View style={[styles.dot, { backgroundColor: agenda ?? colors.primary }]} />
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {calendarName}
                </AppText>
              </View>
            )}
            {task.tags.slice(0, 3).map((tag) => (
              <AppText key={tag} variant="caption" style={{ color: colors.primaryInk }}>
                {`#${tag}`}
              </AppText>
            ))}
            {task.pending && <Icon name="cloud-upload-outline" size={13} color={colors.textMuted} />}
          </View>
        )}
      </View>
      <View style={styles.right}>
        {marks ? (
          <AppText style={[styles.marks, { color: priorityColor }]} accessibilityElementsHidden>
            {marks}
          </AppText>
        ) : null}
        {assignee && <Avatar name={assignee.name} color={assignee.color} size={24} />}
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    paddingLeft: spacing.xs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: MIN_TOUCH + 8,
  },
  compact: { paddingVertical: spacing.sm },
  // Só o título: centraliza na altura da linha em vez de ficar colado no alto.
  centered: { alignItems: 'center' },
  checkTouch: { width: 44, minHeight: 32, alignItems: 'center', paddingTop: 1 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkReminder: { borderRadius: 7 },
  body: { flex: 1, gap: 4, paddingTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { flexShrink: 1, ...fonte('semi') },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: 180 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  right: { alignItems: 'flex-end', gap: spacing.xs, paddingTop: 2 },
  marks: { fontSize: 15, lineHeight: 18, ...fonte('tituloForte'), letterSpacing: -0.5 },
});
