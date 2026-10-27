// Grade de horários (visões semanal e diária): eventos posicionados pelo
// início e duração, lado a lado quando se sobrepõem, área própria para dia
// inteiro, linha do horário atual, tarefas e lembretes com horário e
// horários livres (na visão diária).
//
// Mover: toque longo num evento entra no modo de mover. Dá para arrastar
// (de 15 em 15 minutos, e para o lado para trocar de dia) ou usar os botões
// da barra de baixo, que são a alternativa para quem não usa gestos.
import { memo, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { PanResponder, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { strings, t } from '@/i18n';
import type { DateKey, Occurrence, Task, TimeFormat } from '@/models/types';
import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, fonte, mix, motion, radius, spacing } from '@/theme/tokens';
import { dateKeyParts, formatClock, formatTime, spannedDayKeys } from '@/utils/dates';
import type { FreeSlot } from '@/utils/freeTime';
import { layoutDay, minutesIntoDay, snapMinutes, type GridBox } from '@/utils/timeGrid';
import { dueInstant, isOpen, shortTime } from '@/utils/tasks';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';
import { PressableScale, tapFeedback } from './motion';

export interface TimeGridProps {
  days: DateKey[];
  today: DateKey;
  occurrences: Occurrence[];
  tasks: Task[];
  timezone: string;
  timeFormat: TimeFormat;
  calendarColors: Record<string, string | undefined>;
  conflicts: Set<string>;
  now: number;
  freeSlots?: FreeSlot[];
  canMove: (occ: Occurrence) => boolean;
  onPressEvent: (occ: Occurrence) => void;
  onPressTask: (task: Task) => void;
  onMove: (occ: Occurrence, start: Date) => void;
  onPressDay?: (day: DateKey) => void;
  /** Hora em que a grade abre rolada (padrão: 7h ou a hora atual). */
  initialHour?: number;
}

const HOUR = 52;
const GUTTER = 44;
const TASK_MINUTES = 30;

interface Moving {
  occ: Occurrence;
  /** Deslocamento em minutos e dias enquanto arrasta ou usa os botões. */
  minutes: number;
  days: number;
}

const EventBox = memo(function EventBox({
  occ,
  box,
  color,
  conflict,
  width,
  timezone,
  timeFormat,
  moving,
  dayWidth,
  onPress,
  onLongPress,
  onDrag,
  onDrop,
}: {
  occ: Occurrence;
  box: GridBox;
  color: string;
  conflict: boolean;
  width: number;
  timezone: string;
  timeFormat: TimeFormat;
  moving: Moving | null;
  dayWidth: number;
  onPress: () => void;
  onLongPress: () => void;
  onDrag: (minutes: number, days: number) => void;
  onDrop: () => void;
}) {
  const { colors, dark, reduceMotion } = useAppTheme();
  const active = !!moving && moving.occ.key === occ.key;
  const lift = useSharedValue(0);
  useEffect(() => {
    lift.value = reduceMotion
      ? withTiming(active ? 1 : 0, { duration: 120 })
      : withSpring(active ? 1 : 0, motion.mola);
  }, [active, reduceMotion, lift]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.03 * lift.value }],
    zIndex: active ? 5 : 1,
  }));

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => active,
        onMoveShouldSetPanResponder: () => active,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          const minutes = snapMinutes((g.dy / HOUR) * 60);
          const days = dayWidth > 0 ? Math.round(g.dx / dayWidth) : 0;
          onDrag(minutes, days);
        },
        onPanResponderRelease: () => onDrop(),
      }),
    [active, dayWidth, onDrag, onDrop],
  );

  const offsetTop = active ? (moving!.minutes / 60) * HOUR : 0;
  const offsetLeft = active ? moving!.days * dayWidth : 0;
  const bg = dark ? mix(color, colors.surface, 0.6) : mix(color, '#FFFFFF', 0.82);
  const title = occ.event.is_masked ? t('events.maskedTitle') : (occ.title ?? '');
  const time = `${formatTime(occ.start, timezone, timeFormat)} a ${formatTime(occ.end, timezone, timeFormat)}`;
  const height = Math.max(20, (box.height / 60) * HOUR - 2);
  const narrow = width / box.lanes < 90;
  return (
    <Animated.View
      {...(active ? responder.panHandlers : {})}
      style={[
        styles.box,
        {
          top: (box.top / 60) * HOUR + offsetTop,
          height,
          left: (box.lane / box.lanes) * width + offsetLeft,
          width: width / box.lanes - 2,
          backgroundColor: bg,
          borderLeftColor: color,
          borderColor: active ? colors.primary : conflict ? colors.warning : 'transparent',
          opacity: occ.event.status === 'completed' ? 0.6 : 1,
        },
        style,
      ]}
    >
      <PressableScale
        scaleTo={0.99}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={300}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${time}${conflict ? `. ${t('calendarGrid.conflict')}` : ''}`}
        accessibilityHint={t('calendarGrid.moveHint')}
        style={styles.boxInner}
      >
        {/* Coluna estreita (semana no celular): uma linha com reticências, sem quebrar a palavra no meio. */}
        <AppText
          numberOfLines={narrow || height <= 36 ? 1 : 2}
          style={[styles.boxTitle, { color: colors.text }]}
        >
          {title}
        </AppText>
        {height > 40 && (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {narrow ? formatTime(occ.start, timezone, timeFormat) : time}
          </AppText>
        )}
      </PressableScale>
    </Animated.View>
  );
});

export function TimeGrid({
  days,
  today,
  occurrences,
  tasks,
  timezone,
  timeFormat,
  calendarColors,
  conflicts,
  now,
  freeSlots,
  canMove,
  onPressEvent,
  onPressTask,
  onMove,
  onPressDay,
  initialHour,
}: TimeGridProps) {
  const { colors, dark } = useAppTheme();
  const [width, setWidth] = useState(0);
  const [moving, setMoving] = useState<Moving | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const columnWidth = width > 0 ? (width - GUTTER) / days.length : 0;
  const single = days.length === 1;

  const timed = occurrences.filter((o) => !o.allDay);
  const allDay = occurrences.filter((o) => o.allDay);
  const timedTasks = tasks.filter((x) => isOpen(x) && x.due_date && x.due_time && days.includes(x.due_date));
  const dateTasks = tasks.filter((x) => x.due_date && !x.due_time && days.includes(x.due_date));

  const perDay = useMemo(
    () =>
      days.map((day) => {
        const items = [
          ...timed.map((o) => ({ key: o.key, start: o.start, end: o.end })),
          ...timedTasks
            .filter((x) => x.due_date === day)
            .map((x) => {
              const start = dueInstant(x)!;
              return { key: `task:${x.id}`, start, end: new Date(start.getTime() + TASK_MINUTES * 60_000) };
            }),
        ];
        return layoutDay(items, day, timezone);
      }),
    [days, timed, timedTasks, timezone],
  );
  const occByKey = useMemo(() => Object.fromEntries(timed.map((o) => [o.key, o])), [timed]);
  const taskById = useMemo(() => Object.fromEntries(timedTasks.map((x) => [x.id, x])), [timedTasks]);

  useEffect(() => {
    const start = initialHour ?? Math.max(0, Math.min(17, new Date(now).getHours() - 1));
    const id = setTimeout(
      () => scroll.current?.scrollTo({ y: Math.max(0, (start || 7) * HOUR - 8), animated: false }),
      0,
    );
    return () => clearTimeout(id);
    // Rola só ao abrir a grade ou trocar de período.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join(',')]);

  const drop = () => {
    if (!moving) return;
    const { occ, minutes, days: d } = moving;
    setMoving(null);
    if (!minutes && !d) return;
    tapFeedback('success');
    onMove(occ, new Date(occ.start.getTime() + (minutes + d * 1440) * 60_000));
  };
  const nudge = (minutes: number, d: number) =>
    setMoving((m) => (m ? { ...m, minutes: m.minutes + minutes, days: m.days + d } : m));

  const hours = Array.from({ length: 24 }, (_, h) => h);
  const nowLine = days.map((day) => minutesIntoDay(new Date(now), day, timezone));

  return (
    <View style={styles.wrap} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {!single && (
        <View style={[styles.header, { paddingLeft: GUTTER, borderBottomColor: colors.border }]}>
          {days.map((day) => {
            const { day: d } = dateKeyParts(day);
            const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
            const isToday = day === today;
            return (
              <PressableScale
                scaleTo={0.99}
                key={day}
                onPress={() => onPressDay?.(day)}
                accessibilityRole="button"
                accessibilityLabel={`${strings.weekdays.long[wd]} ${d}${isToday ? `, ${t('common.today')}` : ''}`}
                style={styles.headerCell}
              >
                <AppText variant="overline" tone={isToday ? 'brand' : 'muted'} maxFontSizeMultiplier={1.2}>
                  {strings.weekdays.short[wd]}
                </AppText>
                <View style={[styles.headerNum, isToday && { backgroundColor: colors.primary }]}>
                  <AppText
                    maxFontSizeMultiplier={1.2}
                    style={[styles.headerNumText, { color: isToday ? colors.primaryText : colors.text }]}
                  >
                    {d}
                  </AppText>
                </View>
              </PressableScale>
            );
          })}
        </View>
      )}

      {(allDay.length > 0 || dateTasks.length > 0) && (
        <View style={[styles.allDay, { borderBottomColor: colors.border }]}>
          <AppText variant="caption" tone="muted" style={{ width: GUTTER }} numberOfLines={2}>
            {t('calendarGrid.allDay')}
          </AppText>
          {days.map((day) => (
            <View key={day} style={[styles.allDayCol, { width: columnWidth }]}>
              {allDay
                .filter((o) => spannedDayKeys(o, timezone).includes(day))
                .map((o) => {
                  const color =
                    agendaColor(o.event.color ?? calendarColors[o.event.calendar_id], dark) ?? colors.primary;
                  return (
                    <PressableScale
                      scaleTo={0.99}
                      key={`${o.key}-${day}`}
                      onPress={() => onPressEvent(o)}
                      accessibilityRole="button"
                      accessibilityLabel={`${o.title ?? ''}. ${t('calendarGrid.allDay')}`}
                      style={[styles.chip, { backgroundColor: color }]}
                    >
                      <AppText numberOfLines={1} style={[styles.chipText, { color: '#FFFFFF' }]}>
                        {o.event.is_masked ? t('events.maskedTitle') : o.title}
                      </AppText>
                    </PressableScale>
                  );
                })}
              {dateTasks
                .filter((x) => x.due_date === day)
                .map((x) => (
                  <PressableScale
                    scaleTo={0.99}
                    key={x.id}
                    onPress={() => onPressTask(x)}
                    accessibilityRole="button"
                    accessibilityLabel={`${x.item_type === 'reminder' ? t('create.reminder') : t('create.task')}: ${x.title}`}
                    style={[
                      styles.chip,
                      styles.taskChip,
                      { borderColor: colors.primaryInk, opacity: isOpen(x) ? 1 : 0.5 },
                    ]}
                  >
                    <Icon
                      name={
                        !isOpen(x)
                          ? 'checkmark'
                          : x.item_type === 'reminder'
                            ? 'notifications-outline'
                            : 'task-outline'
                      }
                      size={11}
                      color={colors.primaryInk}
                    />
                    <AppText
                      numberOfLines={1}
                      style={[
                        styles.chipText,
                        { color: colors.primaryInk },
                        !isOpen(x) && { textDecorationLine: 'line-through' },
                      ]}
                    >
                      {x.title}
                    </AppText>
                  </PressableScale>
                ))}
            </View>
          ))}
        </View>
      )}

      <ScrollView
        ref={scroll}
        scrollEnabled={!moving}
        style={styles.flex}
        contentContainerStyle={{ height: 24 * HOUR + 16 }}
      >
        <View style={{ height: 24 * HOUR, marginTop: 8 }}>
          {hours.map((h) => (
            <View key={h} style={[styles.hourRow, { top: h * HOUR }]}>
              <AppText variant="caption" tone="muted" style={styles.hourLabel}>
                {h === 0 ? '' : formatClock(h, 0, timeFormat)}
              </AppText>
              <View style={[styles.hourLine, { backgroundColor: colors.border }]} />
            </View>
          ))}
          {days.map((day, i) => (
            <View
              key={day}
              style={[
                styles.column,
                {
                  left: GUTTER + i * columnWidth,
                  width: columnWidth,
                  borderLeftColor: colors.border,
                  backgroundColor:
                    day === today && !single ? mix(colors.primarySoft, colors.background, 0.6) : undefined,
                },
              ]}
            >
              {single &&
                freeSlots
                  ?.filter((s) => s.day === day)
                  .map((s) => {
                    const top = minutesIntoDay(s.start, day, timezone) ?? 0;
                    const end = minutesIntoDay(new Date(s.end.getTime() - 1), day, timezone) ?? top;
                    return (
                      <View
                        key={s.start.toISOString()}
                        pointerEvents="none"
                        style={[
                          styles.free,
                          {
                            top: (top / 60) * HOUR,
                            height: ((end - top) / 60) * HOUR,
                            borderColor: colors.mint,
                            backgroundColor: mix(colors.mint, colors.background, 0.85),
                          },
                        ]}
                      >
                        {end - top >= 45 && (
                          <AppText variant="caption" style={{ color: colors.primaryInk }}>
                            {t('calendarGrid.free')}
                          </AppText>
                        )}
                      </View>
                    );
                  })}
              {perDay[i].map((box) => {
                if (box.key.startsWith('task:')) {
                  const task = taskById[box.key.slice(5)];
                  if (!task) return null;
                  return (
                    <PressableScale
                      scaleTo={0.99}
                      key={box.key}
                      onPress={() => onPressTask(task)}
                      accessibilityRole="button"
                      accessibilityLabel={`${task.item_type === 'reminder' ? t('calendarGrid.reminderAt', { time: shortTime(task.due_time) ?? '' }) : t('calendarGrid.taskAt', { time: shortTime(task.due_time) ?? '' })}: ${task.title}`}
                      style={[
                        styles.taskBox,
                        {
                          top: (box.top / 60) * HOUR,
                          left: (box.lane / box.lanes) * columnWidth,
                          width: columnWidth / box.lanes - 2,
                          borderColor: task.item_type === 'reminder' ? colors.coral : colors.primaryInk,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <Icon
                        name={task.item_type === 'reminder' ? 'notifications-outline' : 'task-outline'}
                        size={12}
                        color={task.item_type === 'reminder' ? colors.coral : colors.primaryInk}
                      />
                      <AppText numberOfLines={1} style={[styles.chipText, { color: colors.text }]}>
                        {task.title}
                      </AppText>
                    </PressableScale>
                  );
                }
                const occ = occByKey[box.key];
                if (!occ) return null;
                const color =
                  agendaColor(occ.event.color ?? calendarColors[occ.event.calendar_id], dark) ??
                  colors.primary;
                return (
                  <EventBox
                    key={`${box.key}-${day}`}
                    occ={occ}
                    box={box}
                    color={color}
                    conflict={conflicts.has(occ.key)}
                    width={columnWidth}
                    dayWidth={columnWidth}
                    timezone={timezone}
                    timeFormat={timeFormat}
                    moving={moving}
                    onPress={() => (moving ? setMoving(null) : onPressEvent(occ))}
                    onLongPress={() => {
                      if (!canMove(occ) || box.continuesBefore || box.continuesAfter) return;
                      tapFeedback('select');
                      setMoving({ occ, minutes: 0, days: 0 });
                    }}
                    onDrag={(minutes, d) => setMoving((m) => (m ? { ...m, minutes, days: d } : m))}
                    onDrop={drop}
                  />
                );
              })}
              {nowLine[i] !== null && (
                <View
                  pointerEvents="none"
                  style={[styles.now, { top: ((nowLine[i] as number) / 60) * HOUR }]}
                >
                  <View style={[styles.nowDot, { backgroundColor: colors.coral }]} />
                  <View style={[styles.nowLine, { backgroundColor: colors.coral }]} />
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {moving && (
        <View style={[styles.moveBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <AppText variant="label" numberOfLines={1}>
            {`${moving.occ.title ?? ''} · ${formatTime(
              new Date(moving.occ.start.getTime() + (moving.minutes + moving.days * 1440) * 60_000),
              timezone,
              timeFormat,
            )}`}
          </AppText>
          <View style={styles.moveButtons}>
            <Button
              title={t('calendarGrid.earlier')}
              variant="secondary"
              compact
              onPress={() => nudge(-15, 0)}
            />
            <Button
              title={t('calendarGrid.later')}
              variant="secondary"
              compact
              onPress={() => nudge(15, 0)}
            />
            <Button
              title={t('calendarGrid.prevDay')}
              variant="secondary"
              compact
              onPress={() => nudge(0, -1)}
            />
            <Button
              title={t('calendarGrid.nextDay')}
              variant="secondary"
              compact
              onPress={() => nudge(0, 1)}
            />
            <Button title={t('common.cancel')} variant="ghost" compact onPress={() => setMoving(null)} />
            <Button title={t('common.done')} compact onPress={drop} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: spacing.xs },
  headerCell: { flex: 1, alignItems: 'center', gap: 2, minHeight: 48 },
  headerNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  headerNumText: { fontSize: 15, lineHeight: 18, ...fonte('negrito'), fontVariant: ['tabular-nums'] },
  allDay: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  allDayCol: { gap: 2, paddingHorizontal: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.xs,
    paddingHorizontal: 4,
    minHeight: 20,
  },
  taskChip: { borderWidth: 1, backgroundColor: 'transparent' },
  chipText: { fontSize: 11, lineHeight: 14, flexShrink: 1, ...fonte('semi') },
  hourRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start' },
  hourLabel: {
    width: GUTTER - 4,
    textAlign: 'right',
    marginTop: -7,
    paddingRight: 4,
    fontVariant: ['tabular-nums'],
  },
  hourLine: { flex: 1, height: StyleSheet.hairlineWidth },
  column: { position: 'absolute', top: 0, bottom: 0, borderLeftWidth: StyleSheet.hairlineWidth },
  box: {
    position: 'absolute',
    borderRadius: radius.xs + 2,
    borderLeftWidth: 3,
    borderWidth: 1,
    overflow: 'hidden',
  },
  boxInner: { flex: 1, paddingHorizontal: 4, paddingVertical: 2 },
  boxTitle: { fontSize: 12, lineHeight: 15, ...fonte('negrito') },
  taskBox: {
    position: 'absolute',
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 5,
  },
  free: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.xs + 2,
    paddingHorizontal: 6,
    paddingTop: 2,
  },
  now: { position: 'absolute', left: -4, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
  nowDot: { width: 8, height: 8, borderRadius: 4 },
  nowLine: { flex: 1, height: 2 },
  moveBar: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: spacing.sm },
  moveButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
