// Quadro: um dia por coluna, como um quadro de cartões. Cada coluna mostra o
// dia inteiro em detalhe: quanto do seu dia está ocupado, os compromissos
// separados em Dia inteiro, Manhã, Tarde e Noite (com horário, local e quem
// vai), as tarefas e lembretes com prazo, e um botão para adicionar algo
// naquele dia. Serve para um dia, a semana ou o mês inteiro (as colunas rolam
// para o lado e cada coluna rola para baixo).
import { memo, useEffect, useMemo, useRef, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { strings, t } from '@/i18n';
import type { DateKey, Occurrence, Task, TimeFormat } from '@/models/types';
import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, elevation, fonte, mix, radius, spacing } from '@/theme/tokens';
import { dateKeyParts, formatTime, spannedDayKeys } from '@/utils/dates';
import { freeSlots, type Interval } from '@/utils/freeTime';
import { sortTasks } from '@/utils/tasks';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { EASE_OUT, EnterItem, PressableScale } from './motion';
import { TaskRow } from './TaskRow';

type Period = 'allDay' | 'morning' | 'afternoon' | 'evening';
const PERIODS: Period[] = ['allDay', 'morning', 'afternoon', 'evening'];

/** Hora local (0 a 23) de um instante, no fuso de exibição. */
function localHour(date: Date, timezone: string): number {
  const h = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone: timezone,
  }).format(date);
  return Number(h) % 24;
}

function periodOf(occ: Occurrence, day: DateKey, timezone: string): Period {
  if (occ.allDay) return 'allDay';
  // Evento que começou num dia anterior conta como "manhã" do dia seguinte.
  const startsToday = spannedDayKeys(occ, timezone)[0] === day;
  const hour = startsToday ? localHour(occ.start, timezone) : 0;
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

export interface BoardViewProps {
  days: DateKey[];
  today: DateKey;
  selected: DateKey;
  occurrences: Occurrence[];
  tasks: Task[];
  timezone: string;
  timeFormat: TimeFormat;
  dayStart: string;
  dayEnd: string;
  calendarColors: Record<string, string>;
  calendarNames: Record<string, string>;
  conflicts: Set<string>;
  /** Intervalos ocupados da própria pessoa (para a barra de ocupação). */
  busy: Interval[];
  canAdd: boolean;
  onSelectDay: (day: DateKey) => void;
  onPressEvent: (occ: Occurrence) => void;
  onPressTask: (task: Task) => void;
  onToggleTask: (task: Task) => void;
  onLongPressTask?: (task: Task) => void;
  onAdd: (day: DateKey) => void;
}

/** Cartão de compromisso dentro da coluna. */
const BoardEvent = memo(function BoardEvent({
  occ,
  color,
  calendarName,
  conflict,
  timezone,
  timeFormat,
  now,
  onPress,
}: {
  occ: Occurrence;
  color: string;
  calendarName?: string;
  conflict: boolean;
  timezone: string;
  timeFormat: TimeFormat;
  now: number;
  onPress: (occ: Occurrence) => void;
}) {
  const { colors, dark } = useAppTheme();
  const e = occ.event;
  const title = e.is_masked ? t('events.maskedTitle') : (occ.title ?? '');
  const cancelled = e.status === 'cancelled';
  const happening = !occ.allDay && !cancelled && occ.start.getTime() <= now && occ.end.getTime() > now;
  const time = occ.allDay
    ? t('calendarView.allDay')
    : `${formatTime(occ.start, timezone, timeFormat)} a ${formatTime(occ.end, timezone, timeFormat)}`;
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={() => onPress(occ)}
      accessibilityRole="button"
      accessibilityLabel={[
        happening ? t('today.now') : null,
        title,
        time,
        calendarName,
        occ.location,
        conflict ? t('calendarView.conflictBadge') : null,
      ]
        .filter(Boolean)
        .join('. ')}
      style={[
        styles.event,
        {
          backgroundColor: dark ? mix(color, colors.surface, 0.8) : mix(color, '#FFFFFF', 0.88),
          borderLeftColor: color,
        },
        happening && { borderColor: colors.primary, borderWidth: 1.5 },
      ]}
    >
      <View style={styles.eventTop}>
        <AppText variant="time" style={{ color: dark ? colors.text : mix(color, colors.text, 0.45) }}>
          {time}
        </AppText>
        {happening && (
          <View style={[styles.nowPill, { backgroundColor: colors.primary }]}>
            <AppText variant="caption" style={{ color: colors.primaryText, ...fonte('negrito') }}>
              {t('today.now')}
            </AppText>
          </View>
        )}
        {conflict && <Icon name="warning-outline" size={14} color={colors.warning} />}
      </View>
      <AppText
        variant="eventTitle"
        numberOfLines={2}
        style={cancelled ? { textDecorationLine: 'line-through', color: colors.textMuted } : undefined}
      >
        {title}
      </AppText>
      {!e.is_masked && occ.location ? (
        <View style={styles.meta}>
          <Icon name="location-outline" size={12} color={colors.textMuted} />
          <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
            {occ.location}
          </AppText>
        </View>
      ) : null}
      <View style={styles.meta}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.flex}>
          {calendarName}
        </AppText>
        {occ.isRecurring && <Icon name="repeat" size={12} color={colors.textMuted} />}
        {e.attendee_ids?.length ? <AttendeeCount n={e.attendee_ids.length} /> : null}
      </View>
    </PressableScale>
  );
});

function AttendeeCount({ n }: { n: number }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.meta}>
      <Icon name="group-outline" size={12} color={colors.textMuted} />
      <AppText variant="caption" tone="muted">
        {n}
      </AppText>
    </View>
  );
}

/** Barra de ocupação: quanto da janela do seu dia (ex.: 8h às 22h) já tem compromisso. */
function LoadBar({ share }: { share: number }) {
  const { colors, reduceMotion } = useAppTheme();
  const width = useSharedValue(0);
  useEffect(() => {
    width.set(reduceMotion ? share : withTiming(share, { duration: 600, easing: EASE_OUT }));
  }, [share, reduceMotion, width]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.round(width.get() * 100)}%` }));
  const tone = share > 0.75 ? colors.coral : share > 0.45 ? colors.warning : colors.primary;
  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
      <Animated.View style={[styles.fill, { backgroundColor: tone }, fill]} />
    </View>
  );
}

function DayColumn({
  day,
  width,
  props,
  index,
}: {
  day: DateKey;
  width: number;
  props: BoardViewProps;
  index: number;
}) {
  const { colors, dark } = useAppTheme();
  const {
    today,
    selected,
    occurrences,
    tasks,
    timezone,
    timeFormat,
    calendarColors,
    calendarNames,
    conflicts,
  } = props;
  const isToday = day === today;
  const isSelected = day === selected;
  const past = day < today;
  const { day: d, month } = dateKeyParts(day);
  const wd = new Date(`${day}T12:00:00Z`).getUTCDay();

  const list = useMemo(
    () =>
      occurrences
        .filter((o) => spannedDayKeys(o, timezone).includes(day))
        .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime()),
    [occurrences, day, timezone],
  );
  const dayTasks = useMemo(
    () =>
      sortTasks(
        tasks.filter((x) => x.due_date === day),
        'due',
      ),
    [tasks, day],
  );
  const share = useMemo(() => {
    const free = freeSlots(props.busy, [day], timezone, props.dayStart, props.dayEnd, { minMinutes: 1 });
    const [sh, sm] = props.dayStart.split(':').map(Number);
    const [eh, em] = props.dayEnd.split(':').map(Number);
    const window = Math.max(1, eh * 60 + em - (sh * 60 + sm));
    const freeMin = free.reduce((sum, s) => sum + s.minutes, 0);
    return Math.max(0, Math.min(1, 1 - freeMin / window));
  }, [props.busy, day, timezone, props.dayStart, props.dayEnd]);

  const groups = PERIODS.map((p) => ({
    p,
    items: list.filter((o) => periodOf(o, day, timezone) === p),
  })).filter((g) => g.items.length);
  const nothing = !list.length && !dayTasks.length;
  const summary = `${t('board.events', { n: list.length })} · ${t('board.tasksCount', { n: dayTasks.length })}`;
  const busyHours = Math.round(share * 10) / 10;

  return (
    <View
      style={[
        styles.column,
        { width, backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : colors.border },
        elevation(1, colors),
        past && { opacity: 0.86 },
      ]}
    >
      <PressableScale
        scaleTo={0.99}
        onPress={() => props.onSelectDay(day)}
        accessibilityRole="header"
        accessibilityLabel={`${strings.weekdays.long[wd]}, ${d} de ${strings.months.long[month - 1]}${isToday ? `, ${t('common.today')}` : ''}. ${summary}`}
        style={styles.head}
      >
        <View style={[styles.dateBadge, { backgroundColor: isToday ? colors.primary : colors.primarySoft }]}>
          <AppText
            variant="overline"
            style={{ color: isToday ? colors.primaryText : colors.primaryInk }}
            maxFontSizeMultiplier={1.2}
          >
            {strings.weekdays.short[wd]}
          </AppText>
          <AppText
            style={[styles.dateNum, { color: isToday ? colors.primaryText : colors.primaryInk }]}
            maxFontSizeMultiplier={1.2}
          >
            {d}
          </AppText>
        </View>
        <View style={[styles.flex, styles.headText]}>
          <AppText variant="label" numberOfLines={1}>
            {isToday
              ? t('common.today')
              : `${strings.weekdays.long[wd].split('-')[0].replace(/^./, (c) => c.toUpperCase())}, ${d} ${strings.months.short[month - 1]}`}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {summary}
          </AppText>
          <LoadBar share={share} />
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {busyHours >= 0.95
              ? t('board.full')
              : share > 0
                ? t('board.busyShare', { n: Math.round(share * 100) })
                : t('board.free')}
          </AppText>
        </View>
      </PressableScale>

      <ScrollView style={styles.flex} contentContainerStyle={styles.body} nestedScrollEnabled>
        {groups.map(({ p, items }) => (
          <View key={p} style={styles.group}>
            <View style={styles.groupHead}>
              <Icon
                name={
                  p === 'allDay' ? 'calendar-outline' : p === 'evening' ? 'star-outline' : 'sunny-outline'
                }
                size={13}
                color={colors.textMuted}
              />
              <AppText variant="overline" tone="muted">
                {t(`board.${p}`)}
              </AppText>
            </View>
            {items.map((occ, i) => (
              <EnterItem key={occ.key} index={index + i} distance={10}>
                <BoardEvent
                  occ={occ}
                  color={
                    agendaColor(occ.event.color ?? calendarColors[occ.event.calendar_id], dark) ??
                    colors.primary
                  }
                  calendarName={calendarNames[occ.event.calendar_id]}
                  conflict={conflicts.has(occ.key)}
                  timezone={timezone}
                  timeFormat={timeFormat}
                  now={Date.now()}
                  onPress={props.onPressEvent}
                />
              </EnterItem>
            ))}
          </View>
        ))}
        {dayTasks.length > 0 && (
          <View style={styles.group}>
            <View style={styles.groupHead}>
              <Icon name="task-outline" size={13} color={colors.textMuted} />
              <AppText variant="overline" tone="muted">
                {t('board.tasks')}
              </AppText>
            </View>
            {dayTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                timeFormat={timeFormat}
                calendarColor={task.calendar_id ? calendarColors[task.calendar_id] : undefined}
                onPress={props.onPressTask}
                onToggle={props.onToggleTask}
                onLongPress={props.onLongPressTask}
                hideList
                compact
              />
            ))}
          </View>
        )}
        {nothing && (
          <View style={styles.empty}>
            <Icon name="sparkles-outline" size={20} color={colors.textMuted} />
            <AppText variant="small" tone="muted" center>
              {past ? t('board.emptyPast') : t('board.empty')}
            </AppText>
          </View>
        )}
        {props.canAdd && !past && (
          <PressableScale
            onPress={() => props.onAdd(day)}
            haptic
            accessibilityRole="button"
            accessibilityLabel={t('board.addOn', { day: `${d} de ${strings.months.long[month - 1]}` })}
            style={[styles.add, { borderColor: colors.inputBorder }]}
          >
            <Icon name="add" size={16} color={colors.primaryInk} />
            <AppText variant="label" style={{ color: colors.primaryInk }}>
              {t('board.add')}
            </AppText>
          </PressableScale>
        )}
      </ScrollView>
    </View>
  );
}

export function BoardView(props: BoardViewProps) {
  const { width } = useWindowDimensions();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const single = props.days.length === 1;
  // Celular: coluna quase da largura da tela (a próxima aparece na borda).
  // Telas largas: cabem várias colunas lado a lado.
  const available = width - spacing.lg * 2;
  const columnW = single
    ? Math.min(available, 640)
    : width < 600
      ? Math.min(available * 0.86, 360)
      : Math.max(240, Math.min(320, available / Math.min(props.days.length, 4.2)));
  const gap = spacing.md;
  const target = Math.max(0, props.days.indexOf(props.selected));
  const key = props.days[0] + props.days.length;

  // Ao abrir ou trocar de período, a coluna do dia escolhido vem para a tela.
  useEffect(() => {
    const id = setTimeout(
      () =>
        scroll.current?.scrollTo({ x: Math.max(0, target * (columnW + gap) - spacing.lg), animated: false }),
      30,
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, columnW]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={!single}
      snapToInterval={width < 600 && !single ? columnW + gap : undefined}
      decelerationRate="fast"
      contentContainerStyle={[styles.row, single && styles.single, { gap }]}
      accessibilityLabel={t('board.title')}
    >
      {props.days.map((day, i) => (
        <DayColumn key={day} day={day} width={columnW} props={props} index={Math.min(i, 3)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.xs },
  single: { flexGrow: 1, justifyContent: 'center' },
  column: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, paddingBottom: spacing.sm },
  headText: { gap: 3 },
  dateBadge: {
    width: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  dateNum: { fontSize: 22, lineHeight: 26, ...fonte('tituloForte'), fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 2 },
  fill: { height: 6, borderRadius: 3 },
  body: { padding: spacing.md, paddingTop: spacing.xs, gap: spacing.md, paddingBottom: 96 },
  group: { gap: spacing.sm },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  event: {
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: spacing.sm + 2,
    gap: 3,
  },
  eventTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  nowPill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  empty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
});
