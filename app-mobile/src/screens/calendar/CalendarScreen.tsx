// Tela principal: calendário em visão mensal, semanal, diária ou lista.
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { FadeIn, FadeOut, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { EventRow } from '@/components/EventRow';
import { FAB } from '@/components/FAB';
import { IconButton } from '@/components/IconButton';
import { EnterItem, MotionView } from '@/components/motion';
import { MonthGrid, type DayInfo } from '@/components/MonthGrid';
import { TaskRow } from '@/components/TaskRow';
import { TimeGrid } from '@/components/TimeGrid';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useLayout } from '@/hooks/useLayout';
import { useCalendarsMap, useOccurrences } from '@/hooks/useEventsView';
import { useTasks } from '@/hooks/useItems';
import { useNow } from '@/hooks/useNow';
import { myBusy } from '@/hooks/usePlanning';
import { useTaskActions } from '@/hooks/useTaskActions';
import { useFeedback } from '@/components/Feedback';
import { moveEvent } from '@/services/eventActions';
import { useUserId } from '@/stores/authStore';
import { t } from '@/i18n';
import type { DateKey, Occurrence, Task } from '@/models/types';
import { ensureRange, syncNow } from '@/offline/syncEngine';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { useUiStore, type CalendarViewMode } from '@/stores/uiStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, SCREEN_MARGIN, spacing } from '@/theme/tokens';
import { conflictingKeys } from '@/utils/conflicts';
import {
  addDaysToKey,
  addMonthsToKey,
  capitalize,
  dateKeyParts,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  monthMatrix,
  toDateKey,
  spannedDayKeys,
  startOfDayInstant,
  todayKey,
  weekKeys,
} from '@/utils/dates';
import { activeFilterCount } from '@/utils/filters';
import { freeSlots } from '@/utils/freeTime';
import { isOpen, sortTasks } from '@/utils/tasks';
import { CONTENT_MAX_WIDTH } from '@/utils/layout';
import { canCreateEvents, canEditEvent } from '@/utils/permissions';

interface Section {
  title: string;
  day: DateKey;
  data: (Occurrence | Task)[];
}

const isOccurrence = (item: Occurrence | Task): item is Occurrence => 'event' in item;

function groupByDay(list: Occurrence[], tz: string, days?: DateKey[]): Map<DateKey, Occurrence[]> {
  const map = new Map<DateKey, Occurrence[]>();
  days?.forEach((d) => map.set(d, []));
  for (const occ of list) {
    for (const day of spannedDayKeys(occ, tz)) {
      if (days && !map.has(day)) continue;
      const bucket = map.get(day) ?? [];
      bucket.push(occ);
      map.set(day, bucket);
    }
  }
  return map;
}

export default function CalendarScreen() {
  const { colors, dark, reduceMotion } = useAppTheme();
  const { twoPane } = useLayout();
  const insets = useSafeAreaInsets();
  const display = useDisplaySettings();
  const tz = display.timezone;
  const today = todayKey(tz);

  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const selected = useUiStore((s) => s.selectedDate) ?? today;
  const setSelected = useUiStore((s) => s.setSelectedDate);
  const filters = useUiStore((s) => s.filters);
  const setFilters = useUiStore((s) => s.setFilters);
  const listTab = useUiStore((s) => s.listTab);
  const setListTab = useUiStore((s) => s.setListTab);
  const layers = useUiStore((s) => s.layers);
  const setLayers = useUiStore((s) => s.setLayers);
  const userId = useUserId();
  const now = useNow();
  const { toast } = useFeedback();
  const allTasks = useTasks();
  const { toggle, openMenu, sheet } = useTaskActions();

  const calendars = useDataStore((s) => s.calendars);
  const hydrated = useDataStore((s) => s.hydrated);
  const calendarsMap = useCalendarsMap();
  const syncing = useSyncStore((s) => s.syncing);

  const { year, month } = dateKeyParts(selected);

  // Período visível em datas locais (no fuso de exibição).
  const [firstDay, lastDay] = useMemo((): [DateKey, DateKey] => {
    if (viewMode === 'month') {
      const grid = monthMatrix(year, month, display.weekStartsOn);
      return [grid[0][0], grid[5][6]];
    }
    if (viewMode === 'week') {
      const week = weekKeys(selected, display.weekStartsOn);
      return [week[0], week[6]];
    }
    if (viewMode === 'day') return [selected, selected];
    return listTab === 'upcoming' ? [today, addDaysToKey(today, 180)] : [addDaysToKey(today, -180), today];
  }, [viewMode, year, month, selected, display.weekStartsOn, listTab, today]);

  const from = useMemo(() => startOfDayInstant(firstDay, tz), [firstDay, tz]);
  const to = useMemo(() => startOfDayInstant(addDaysToKey(lastDay, 1), tz), [lastDay, tz]);
  const rawOccurrences = useOccurrences(from, to, filters);
  const occurrences = useMemo(() => (layers.events ? rawOccurrences : []), [rawOccurrences, layers.events]);
  // Tarefas e lembretes com prazo no período, conforme as camadas ligadas.
  const periodTasks = useMemo(
    () =>
      allTasks.filter(
        (x) =>
          !!x.due_date &&
          x.due_date >= firstDay &&
          x.due_date <= lastDay &&
          (x.item_type === 'reminder' ? layers.reminders : layers.tasks) &&
          (filters.calendarIds.length === 0 ||
            (x.calendar_id && filters.calendarIds.includes(x.calendar_id))),
      ),
    [allTasks, firstDay, lastDay, layers.tasks, layers.reminders, filters.calendarIds],
  );
  const conflicts = useMemo(() => conflictingKeys(occurrences), [occurrences]);

  useEffect(() => {
    void ensureRange(from, to);
  }, [from, to]);

  const byDay = useMemo(() => groupByDay(occurrences, tz), [occurrences, tz]);

  const monthDays = useMemo(() => {
    const info: Record<DateKey, DayInfo> = {};
    byDay.forEach((list, day) => {
      info[day] = {
        count: list.length,
        colors: list.map(
          (o) =>
            agendaColor(o.event.color ?? calendarsMap[o.event.calendar_id]?.color, dark) ?? colors.primary,
        ),
      };
    });
    for (const x of periodTasks) {
      const day = x.due_date!;
      const current = info[day] ?? { count: 0, colors: [] };
      const isReminder = x.item_type === 'reminder';
      info[day] = {
        ...current,
        tasks: (current.tasks ?? 0) + (isReminder ? 0 : 1),
        reminders: (current.reminders ?? 0) + (isReminder ? 1 : 0),
        allDone: (current.allDone ?? true) && !isOpen(x),
      };
    }
    return info;
  }, [byDay, periodTasks, calendarsMap, colors.primary, dark]);
  const tasksOn = (day: DateKey) =>
    sortTasks(
      periodTasks.filter((x) => x.due_date === day),
      'due',
    );
  const openTask = useCallback(
    (task: Task) => router.push({ pathname: '/task/[id]', params: { id: task.id } }),
    [],
  );
  const taskRow = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      today={today}
      timeFormat={display.timeFormat}
      calendarName={task.calendar_id ? calendarsMap[task.calendar_id]?.name : undefined}
      calendarColor={task.calendar_id ? calendarsMap[task.calendar_id]?.color : undefined}
      onPress={openTask}
      onToggle={(x) => void toggle(x)}
      onLongPress={openMenu}
      compact
    />
  );
  const canMove = (occ: Occurrence) => {
    const cal = calendarsMap[occ.event.calendar_id];
    return !!cal && canEditEvent(cal, occ.event, userId);
  };
  const moveTo = async (occ: Occurrence, start: Date) => {
    await moveEvent(occ.event, occ, start);
    toast(
      `${t('calendarGrid.moved', { when: formatShortDate(toDateKey(start, tz)) })}${occ.isRecurring ? ` ${t('calendarGrid.moveRecurring')}` : ''}`,
    );
  };
  const calendarColors = useMemo(
    () => Object.fromEntries(Object.values(calendarsMap).map((c) => [c.id, c.color])),
    [calendarsMap],
  );

  const writable = calendars.filter((c) => canCreateEvents(c));
  const nFilters = activeFilterCount(filters);

  // Direção da última troca de período (para a grade deslizar do lado certo).
  const [direction, setDirection] = useState<1 | -1>(1);
  const move = (dir: 1 | -1) => {
    setDirection(dir);
    if (viewMode === 'month') setSelected(addMonthsToKey(`${selected.slice(0, 7)}-01`, dir));
    else if (viewMode === 'week') setSelected(addDaysToKey(selected, 7 * dir));
    else setSelected(addDaysToKey(selected, dir));
  };

  const openEvent = useCallback(
    (occ: Occurrence) =>
      router.push({ pathname: '/event/[id]', params: { id: occ.event.id, date: occ.originalDate } }),
    [],
  );

  const renderRow = (occ: Occurrence) => (
    <EventRow
      key={occ.key}
      occurrence={occ}
      calendarName={calendarsMap[occ.event.calendar_id]?.name}
      calendarColor={calendarsMap[occ.event.calendar_id]?.color}
      timezone={tz}
      timeFormat={display.timeFormat}
      dateFormat={display.dateFormat}
      conflict={conflicts.has(occ.key)}
      onPress={openEvent}
    />
  );

  const periodTitle =
    viewMode === 'month'
      ? capitalize(formatMonthYear(year, month).split(' de ')[0])
      : viewMode === 'week'
        ? t('calendarView.weekRange', { start: formatShortDate(firstDay), end: formatShortDate(lastDay) })
        : viewMode === 'day'
          ? capitalize(formatLongDate(selected))
          : '';

  if (!hydrated) return <LoadingState />;

  // Computador e tablet grande: mês e lista do dia lado a lado.
  const twoPaneMonth = twoPane && viewMode === 'month';

  const refresh = <RefreshControl refreshing={syncing} onRefresh={() => void syncNow()} />;

  const visibleCalendars = calendars.filter((c) => !c.deleted_at);
  const toggleCalendar = (id: string | null) => {
    if (!id) return setFilters({ ...filters, calendarIds: [] });
    const has = filters.calendarIds.includes(id);
    setFilters({
      ...filters,
      calendarIds: has ? filters.calendarIds.filter((x) => x !== id) : [...filters.calendarIds, id],
    });
  };

  const header = (
    <View style={styles.controls}>
      <View style={[styles.titleRow, { paddingTop: insets.top + spacing.md }]}>
        <AppText
          variant="title"
          style={styles.monthTitle}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          {viewMode === 'list' ? t('calendarView.list') : periodTitle}
          {viewMode === 'month' ? (
            <AppText variant="title" tone="muted" style={styles.monthTitle}>{` ${year}`}</AppText>
          ) : null}
        </AppText>
        {viewMode !== 'list' && (
          <>
            <IconButton icon="chevron-back" label={t('calendarView.previous')} onPress={() => move(-1)} />
            <IconButton icon="chevron-forward" label={t('calendarView.next')} onPress={() => move(1)} />
          </>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          label={t('calendarView.allCalendars')}
          selected={filters.calendarIds.length === 0}
          onPress={() => toggleCalendar(null)}
        />
        {visibleCalendars.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            color={agendaColor(c.color, dark)}
            selected={filters.calendarIds.includes(c.id)}
            onPress={() => toggleCalendar(c.id)}
          />
        ))}
      </ScrollView>
      <View style={styles.modeRow}>
        <View style={styles.flex}>
          <SegmentedControl<CalendarViewMode>
            label={t('tabs.calendar')}
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'month', label: t('calendarView.month') },
              { value: 'week', label: t('calendarView.week') },
              { value: 'day', label: t('calendarView.day') },
              { value: 'list', label: t('calendarView.list') },
            ]}
          />
        </View>
        <IconButton icon="search" label={t('common.search')} onPress={() => router.push('/search')} />
        <IconButton
          icon={nFilters ? 'funnel' : 'funnel-outline'}
          label={
            nFilters ? `${t('common.filters')}, ${t('filters.active', { n: nFilters })}` : t('common.filters')
          }
          onPress={() => router.push('/filters')}
          color={nFilters ? colors.primaryInk : undefined}
        />
      </View>
      <View style={styles.layers} accessibilityLabel={t('calendarGrid.types')}>
        <Chip
          label={t('calendarGrid.typeEvents')}
          selected={layers.events}
          onPress={() => setLayers({ ...layers, events: !layers.events })}
        />
        <Chip
          label={t('calendarGrid.typeTasks')}
          selected={layers.tasks}
          onPress={() => setLayers({ ...layers, tasks: !layers.tasks })}
        />
        <Chip
          label={t('calendarGrid.typeReminders')}
          selected={layers.reminders}
          onPress={() => setLayers({ ...layers, reminders: !layers.reminders })}
        />
      </View>
      {viewMode === 'list' ? (
        <SegmentedControl
          label={t('calendarView.list')}
          value={listTab}
          onChange={setListTab}
          options={[
            { value: 'upcoming', label: t('calendarView.upcoming') },
            { value: 'past', label: t('calendarView.past') },
          ]}
        />
      ) : null}
      {selected !== today && viewMode !== 'list' ? (
        <Chip label={t('calendarView.goToToday')} selected={false} onPress={() => setSelected(today)} />
      ) : null}
    </View>
  );

  const noCalendars = calendars.length === 0;
  const emptyMessage = nFilters ? t('calendarView.noResults') : t('calendarView.emptyMessage');

  const dayEvents = (dayList: Occurrence[]) =>
    dayList.length || tasksOn(selected).length ? (
      <View style={styles.list} key={selected}>
        {dayList.map((occ, i) => (
          <EnterItem key={occ.key} index={i}>
            {renderRow(occ)}
          </EnterItem>
        ))}
        {tasksOn(selected).map(taskRow)}
      </View>
    ) : (
      <AppText tone="muted">
        {noCalendars ? t('calendars.emptyMessage') : t('calendarView.noEventsDay')}
      </AppText>
    );

  // Troca de mês: a grade desliza na horizontal com fade.
  const monthEntering = reduceMotion
    ? FadeIn.duration(150)
    : (direction > 0 ? SlideInRight : SlideInLeft).duration(220);
  const grid = (
    <MotionView key={`${year}-${month}`} entering={monthEntering} exiting={FadeOut.duration(80)}>
      <MonthGrid
        year={year}
        month={month}
        weekStartsOn={display.weekStartsOn}
        selected={selected}
        today={today}
        days={monthDays}
        onSelect={setSelected}
      />
    </MotionView>
  );
  const dayCount = (byDay.get(selected) ?? []).length;
  const dayHeader = t('calendarView.dayHeader', { day: capitalize(formatLongDate(selected)), n: dayCount });

  let content: React.ReactNode;
  if (twoPaneMonth) {
    content = (
      <View style={styles.panes}>
        <ScrollView style={styles.leftPane} refreshControl={refresh} contentContainerStyle={styles.scroll}>
          {header}
          {grid}
        </ScrollView>
        <ScrollView
          style={[styles.rightPane, { borderLeftColor: colors.border }]}
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xxl }]}
        >
          <AppText variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
            {capitalize(formatLongDate(selected))}
          </AppText>
          <AppText variant="overline" tone="muted">
            {t('calendarView.eventsCount', { n: dayCount })}
          </AppText>
          {dayEvents(byDay.get(selected) ?? [])}
        </ScrollView>
      </View>
    );
  } else if (viewMode === 'month') {
    const dayList = byDay.get(selected) ?? [];
    content = (
      <ScrollView refreshControl={refresh} contentContainerStyle={[styles.scroll, styles.column]}>
        {header}
        {grid}
        <AppText variant="overline" tone="muted" style={styles.dayTitle} accessibilityRole="header">
          {dayHeader}
        </AppText>
        {dayEvents(dayList)}
      </ScrollView>
    );
  } else if (viewMode === 'week' || viewMode === 'day') {
    // Semana e dia: grade de horários de verdade.
    const days = viewMode === 'week' ? weekKeys(selected, display.weekStartsOn) : [selected];
    const slots =
      viewMode === 'day'
        ? freeSlots(
            myBusy(byDay.get(selected) ?? [], userId),
            [selected],
            tz,
            display.dayStart,
            display.dayEnd,
            {
              minMinutes: 30,
              now: new Date(now),
            },
          )
        : undefined;
    content = (
      <View style={styles.flex}>
        <View style={[styles.gridHeader, styles.column]}>{header}</View>
        <View style={[styles.flex, styles.gridBody]}>
          <TimeGrid
            days={days}
            today={today}
            occurrences={occurrences}
            tasks={periodTasks}
            timezone={tz}
            timeFormat={display.timeFormat}
            calendarColors={calendarColors}
            conflicts={conflicts}
            now={now}
            freeSlots={slots}
            canMove={canMove}
            onPressEvent={openEvent}
            onPressTask={openTask}
            onMove={(occ, start) => void moveTo(occ, start)}
            onPressDay={(day) => {
              setSelected(day);
              setViewMode('day');
            }}
          />
        </View>
      </View>
    );
  } else {
    // Lista: seções por dia, com rolagem virtualizada (listas longas).
    const sections: Section[] = [];
    const entries = [...groupByDay(occurrences, tz).entries()].filter(([day]) =>
      listTab === 'upcoming' ? day >= today : day <= today,
    );
    entries.sort(([a], [b]) => (listTab === 'upcoming' ? a.localeCompare(b) : b.localeCompare(a)));
    const taskDays = new Set(periodTasks.map((x) => x.due_date!));
    for (const day of taskDays)
      if (!entries.some(([d]) => d === day) && (listTab === 'upcoming' ? day >= today : day <= today))
        entries.push([day, []]);
    entries.sort(([a], [b]) => (listTab === 'upcoming' ? a.localeCompare(b) : b.localeCompare(a)));
    for (const [day, data] of entries) {
      const items = listTab === 'past' ? data.filter((o) => o.end <= new Date() || day < today) : data;
      const all = [...items, ...tasksOn(day)];
      if (all.length) sections.push({ day, title: capitalize(formatLongDate(day, true)), data: all });
    }
    content = (
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${isOccurrence(item) ? item.key : item.id}-${index}`}
        ListHeaderComponent={header}
        refreshControl={refresh}
        contentContainerStyle={[styles.scroll, styles.column]}
        stickySectionHeadersEnabled={false}
        initialNumToRender={15}
        windowSize={7}
        renderSectionHeader={({ section }) => (
          <AppText
            variant="overline"
            tone={section.day === today ? 'brand' : 'muted'}
            style={styles.dayTitle}
            accessibilityRole="header"
          >
            {section.title}
          </AppText>
        )}
        renderItem={({ item }) => (
          <View style={styles.listItem}>{isOccurrence(item) ? renderRow(item) : taskRow(item)}</View>
        )}
        ListEmptyComponent={
          <EmptyState
            title={nFilters ? t('calendarView.noResults') : t('calendarView.emptyTitle')}
            message={emptyMessage}
          />
        }
      />
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      {noCalendars && hydrated && !syncing ? (
        <EmptyState
          art="orbit"
          title={t('calendars.emptyTitle')}
          message={t('calendars.emptyMessage')}
          actionLabel={t('calendars.new')}
          onAction={() => router.push('/calendar/new')}
        />
      ) : (
        content
      )}
      {writable.length > 0 && (
        <FAB
          label={t('calendarView.newEvent')}
          onPress={() => router.push({ pathname: '/create', params: { date: selected } })}
        />
      )}
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: SCREEN_MARGIN, gap: spacing.md, paddingBottom: 120 },
  column: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  panes: { flex: 1, flexDirection: 'row' },
  leftPane: { flex: 1, maxWidth: 560 },
  rightPane: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth },
  controls: { gap: spacing.md, marginBottom: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  monthTitle: { flex: 1, fontSize: 26, lineHeight: 32 },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dayTitle: { marginTop: spacing.md, marginBottom: spacing.xs },
  layers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridHeader: { paddingHorizontal: SCREEN_MARGIN },
  gridBody: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  list: { gap: spacing.sm },
  listItem: { marginBottom: spacing.sm },
  weekDay: { gap: spacing.sm, marginTop: spacing.sm },
});
