// Tela Hoje: central do dia. Data e saudação, semana compacta, faixa de
// sincronização, a pergunta "O que você pretende fazer hoje?", o próximo
// compromisso e seções recolhíveis (agenda, tarefas, atrasadas, lembretes,
// movimento nas agendas, horários livres e o resumo da semana).
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { OrbitRings, useDecorSize } from '@/components/brand/Decor';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EventRow } from '@/components/EventRow';
import { FAB } from '@/components/FAB';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { EnterItem, MotionView, PressableScale, tapFeedback } from '@/components/motion';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { TaskRow } from '@/components/TaskRow';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useCalendarsMap, useOccurrences } from '@/hooks/useEventsView';
import { useItems } from '@/hooks/useItems';
import { useNow } from '@/hooks/useNow';
import { usePeople, useSharedMembers } from '@/hooks/usePeople';
import { myBusy } from '@/hooks/usePlanning';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { useTaskActions } from '@/hooks/useTaskActions';
import { strings, t } from '@/i18n';
import type { DateKey, Occurrence, Task } from '@/models/types';
import { ensureRange, syncNow } from '@/offline/syncEngine';
import { useAuthStore, useUserId } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { useUiStore } from '@/stores/uiStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte, motion, radius, SCREEN_MARGIN, spacing } from '@/theme/tokens';
import { conflictingKeys } from '@/utils/conflicts';
import { shouldAskToday } from '@/utils/dailyPlan';
import {
  addDaysToKey,
  capitalize,
  dateKeyParts,
  formatLongDate,
  formatRelative,
  formatTime,
  spannedDayKeys,
  startOfDayInstant,
  todayKey,
  weekKeys,
} from '@/utils/dates';
import { freeSlots } from '@/utils/freeTime';
import { CONTENT_MAX_WIDTH } from '@/utils/layout';
import { isOpen, isOverdue, sortTasks } from '@/utils/tasks';

function greeting(name: string, hour: number): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  const key = hour < 12 ? 'today.morning' : hour < 18 ? 'today.afternoon' : 'today.evening';
  return t(key, { name: first });
}

/** Semana compacta: a bolha do dia escolhido escorrega até o dia novo. */
function WeekStrip({
  days,
  selected,
  today,
  busy,
  onSelect,
}: {
  days: DateKey[];
  selected: DateKey;
  today: DateKey;
  busy: Set<DateKey>;
  onSelect: (day: DateKey) => void;
}) {
  const { colors, reduceMotion } = useAppTheme();
  const [cell, setCell] = useState(0);
  const index = Math.max(0, days.indexOf(selected));
  const x = useSharedValue(index * cell);
  const placed = useRef(false);
  useEffect(() => {
    if (!cell) return;
    if (!placed.current) {
      placed.current = true;
      x.value = index * cell;
      return;
    }
    x.value = reduceMotion
      ? withTiming(index * cell, { duration: 150 })
      : withSpring(index * cell, motion.mola);
  }, [index, cell, reduceMotion, x]);
  const bubble = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const bubbleW = Math.min(44, cell - 4);

  return (
    <View
      style={styles.week}
      onLayout={(e) => setCell(e.nativeEvent.layout.width / 7)}
      accessibilityRole="tablist"
    >
      {cell > 0 && (
        <Animated.View
          style={[
            styles.bubble,
            { width: bubbleW, left: (cell - bubbleW) / 2, backgroundColor: colors.primary },
            bubble,
          ]}
        />
      )}
      {days.map((day) => {
        const { day: d } = dateKeyParts(day);
        const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
        const isSel = day === selected;
        const fg = isSel ? colors.primaryText : day < today ? colors.textMuted : colors.text;
        return (
          <PressableScale
            key={day}
            onPress={() => {
              if (!isSel) tapFeedback('select');
              onSelect(day);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSel }}
            accessibilityLabel={`${formatLongDate(day)}${day === today ? `, ${t('common.today')}` : ''}${busy.has(day) ? `, ${t('today.hasEvents')}` : ''}`}
            style={styles.weekCell}
          >
            <AppText
              variant="overline"
              maxFontSizeMultiplier={1.2}
              style={{ color: isSel ? fg : colors.textMuted }}
            >
              {strings.weekdays.letter[wd]}
            </AppText>
            <AppText
              maxFontSizeMultiplier={1.2}
              style={[styles.weekNum, { color: fg }, (isSel || day === today) && fonte('tituloForte')]}
            >
              {d}
            </AppText>
            <View
              style={[
                styles.weekDot,
                {
                  backgroundColor: busy.has(day)
                    ? isSel
                      ? colors.primaryText
                      : colors.coral
                    : 'transparent',
                },
              ]}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Faixa "Tudo sincronizado · N agendas": o ícone gira enquanto sincroniza. */
function SyncPill({ calendars }: { calendars: number }) {
  const { colors, reduceMotion } = useAppTheme();
  const syncing = useSyncStore((s) => s.syncing);
  const pending = useSyncStore((s) => s.outbox.length);
  const online = useSyncStore((s) => s.online);
  const spin = useSharedValue(0);
  useEffect(() => {
    if (syncing && !reduceMotion) {
      spin.value = 0;
      spin.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1);
    } else {
      cancelAnimation(spin);
      spin.value = withTiming(0, { duration: 200 });
    }
  }, [syncing, reduceMotion, spin]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const warn = !online || pending > 0;
  const text = !online
    ? t('today.offline')
    : syncing
      ? t('today.syncing')
      : pending
        ? t('today.pending', { n: pending })
        : t('today.synced', { n: calendars });
  return (
    <PressableScale
      onPress={() => router.push('/sync')}
      accessibilityRole="button"
      accessibilityLabel={text}
      style={[styles.pill, { backgroundColor: warn ? colors.warningSoft : colors.primarySoft }]}
    >
      <Animated.View style={iconStyle}>
        <Icon
          name={!online ? 'cloud-offline-outline' : 'sync-outline'}
          size={16}
          color={warn ? colors.warning : colors.primaryInk}
        />
      </Animated.View>
      <AppText variant="label" style={{ color: warn ? colors.warning : colors.primaryInk }}>
        {text}
      </AppText>
    </PressableScale>
  );
}

/** Seção recolhível (o estado fica guardado no aparelho). */
function Section({
  id,
  title,
  count,
  icon,
  tone,
  children,
  defaultCollapsed,
}: {
  id: string;
  title: string;
  count?: number;
  icon: IconName;
  tone?: 'danger';
  children: ReactNode;
  defaultCollapsed?: boolean;
}) {
  const { colors } = useAppTheme();
  const collapsedList = useUiStore((s) => s.collapsed);
  const toggle = useUiStore((s) => s.toggleCollapsed);
  // "defaultCollapsed": a seção começa fechada e a lista guarda as que foram abertas.
  const flagged = collapsedList.includes(id);
  const collapsed = defaultCollapsed ? !flagged : flagged;
  const color = tone === 'danger' ? colors.danger : colors.textMuted;
  return (
    <View style={styles.section}>
      <PressableScale
        onPress={() => {
          tapFeedback('select');
          toggle(id);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={`${title}${count !== undefined ? `, ${count}` : ''}. ${collapsed ? t('todayHub.expand') : t('todayHub.collapse')}`}
        style={styles.sectionHeader}
      >
        <Icon name={icon} size={16} color={color} />
        <AppText variant="overline" style={[styles.flex, { color }]}>
          {count !== undefined ? `${title} · ${count}` : title}
        </AppText>
        <Icon name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color={colors.textMuted} />
      </PressableScale>
      {!collapsed && (
        <MotionView entering={FadeIn.duration(160)} style={styles.sectionBody}>
          {children}
        </MotionView>
      )}
    </View>
  );
}

/** Próximo compromisso (ou o que está acontecendo), com contagem regressiva. */
function NextUp({ occ, now, timezone }: { occ: Occurrence; now: number; timezone: string }) {
  const { colors } = useAppTheme();
  const display = useDisplaySettings();
  const happening = occ.start.getTime() <= now;
  const minutes = Math.max(0, Math.round((occ.start.getTime() - now) / 60_000));
  const when = happening
    ? t('todayHub.happening')
    : minutes < 60
      ? t('todayHub.nextIn', { time: `${minutes} min` })
      : t('todayHub.nextIn', {
          time: `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`,
        });
  return (
    <Card
      outlined={happening}
      onPress={() =>
        router.push({ pathname: '/event/[id]', params: { id: occ.event.id, date: occ.originalDate } })
      }
      accessibilityLabel={`${t('todayHub.next')}: ${occ.event.is_masked ? t('events.maskedTitle') : occ.title}. ${when}`}
      style={[styles.next, { backgroundColor: colors.tide }]}
    >
      <AppText variant="overline" style={{ color: colors.mint }}>
        {t('todayHub.next')}
      </AppText>
      <AppText variant="title" numberOfLines={2} style={{ color: '#FFFFFF' }}>
        {occ.event.is_masked ? t('events.maskedTitle') : occ.title}
      </AppText>
      <View style={styles.nextRow}>
        <Icon name="time-outline" size={16} color={colors.mint} />
        <AppText variant="label" style={{ color: '#FFFFFF' }}>
          {`${formatTime(occ.start, timezone, display.timeFormat)} · ${when}`}
        </AppText>
      </View>
      {occ.location ? (
        <View style={styles.nextRow}>
          <Icon name="location-outline" size={16} color={colors.mint} />
          <AppText variant="small" numberOfLines={1} style={{ color: '#FFFFFF' }}>
            {occ.location}
          </AppText>
        </View>
      ) : null}
    </Card>
  );
}

export default function TodayScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const focused = useScreenFocus();
  const display = useDisplaySettings();
  const tz = display.timezone;
  const today = todayKey(tz);
  const now = useNow();
  const [picked, setPicked] = useState<DateKey | null>(null);
  const selected = picked ?? today;
  const setSelected = (day: DateKey) => setPicked(day === today ? null : day);
  const account = useAuthStore((s) => s.account);
  const name = account?.display_name ?? '';
  const userId = useUserId();
  const calendars = useDataStore((s) => s.calendars);
  const hydrated = useDataStore((s) => s.hydrated);
  const notifications = useDataStore((s) => s.notifications);
  const unread = notifications.filter((n) => !n.read_at).length;
  const calendarsMap = useCalendarsMap();
  const syncing = useSyncStore((s) => s.syncing);
  const dismissedOn = useUiStore((s) => s.planDismissedOn);
  // Pergunta do dia: aparece sozinha uma vez por dia (se a pessoa não desligou).
  const shownOn = useUiStore((s) => s.planShownOn);
  const items = useItems();
  const people = usePeople();
  useSharedMembers();
  const { toggle, openMenu, sheet } = useTaskActions();
  const decor = Math.min(useDecorSize('header') * 1.25, 168);

  const days = useMemo(() => weekKeys(selected, display.weekStartsOn), [selected, display.weekStartsOn]);
  const from = useMemo(() => startOfDayInstant(days[0], tz), [days, tz]);
  const to = useMemo(() => startOfDayInstant(addDaysToKey(days[6], 1), tz), [days, tz]);
  const occurrences = useOccurrences(from, to);
  const conflicts = useMemo(() => conflictingKeys(occurrences), [occurrences]);

  useEffect(() => {
    void ensureRange(from, to);
  }, [from, to]);

  // Primeira abertura do dia: "O que você pretende fazer hoje?".
  const checkedIn = items.checkins.includes(today);
  const ask = shouldAskToday({
    enabled: account?.preferences.daily_checkin ?? true,
    today,
    checkins: items.checkins,
    dismissedOn,
  });
  const opened = useRef(false);
  useEffect(() => {
    if (!hydrated || !focused || !ask || shownOn === today || opened.current) return;
    opened.current = true;
    useUiStore.getState().setPlanShownOn(today);
    const timer = setTimeout(() => router.push('/plan-day'), 500);
    return () => clearTimeout(timer);
  }, [hydrated, focused, ask, today, shownOn]);

  const byDay = useMemo(() => {
    const map = new Map<DateKey, Occurrence[]>();
    for (const occ of occurrences) {
      for (const day of spannedDayKeys(occ, tz)) {
        const list = map.get(day) ?? [];
        list.push(occ);
        map.set(day, list);
      }
    }
    return map;
  }, [occurrences, tz]);
  const tasks = useMemo(() => Object.values(items.tasks), [items.tasks]);
  const busy = useMemo(() => {
    const set = new Set(byDay.keys());
    for (const x of tasks) if (isOpen(x) && x.due_date) set.add(x.due_date);
    return set;
  }, [byDay, tasks]);
  const list = byDay.get(selected) ?? [];
  const isToday = selected === today;

  const open = tasks.filter(isOpen);
  const dayTasks = sortTasks(
    open.filter(
      (x) => x.item_type === 'task' && (x.due_date === selected || (isToday && x.plan_day === today)),
    ),
    'due',
  );
  const overdue = isToday
    ? sortTasks(
        open.filter((x) => isOverdue(x, today) && x.due_date !== today && x.plan_day !== today),
        'due',
      )
    : [];
  const reminders = sortTasks(
    open.filter(
      (x) =>
        x.item_type === 'reminder' &&
        x.due_date &&
        (x.due_date === selected || (isToday && x.due_date === addDaysToKey(today, 1))),
    ),
    'due',
  );
  const nextOcc = isToday
    ? list
        .filter((o) => !o.allDay && o.event.status !== 'cancelled' && o.end.getTime() > now)
        .sort((a, b) => a.start.getTime() - b.start.getTime())[0]
    : undefined;
  const slots = freeSlots(myBusy(list, userId), [selected], tz, display.dayStart, display.dayEnd, {
    minMinutes: 30,
    now: new Date(now),
  });
  const recent = notifications.filter((n) => !n.read_at).slice(0, 3);

  const openEvent = useCallback(
    (occ: Occurrence) =>
      router.push({ pathname: '/event/[id]', params: { id: occ.event.id, date: occ.originalDate } }),
    [],
  );
  const openTask = useCallback(
    (task: Task) => router.push({ pathname: '/task/[id]', params: { id: task.id } }),
    [],
  );
  const active = calendars.filter((c) => !c.deleted_at && c.status === 'active').length;

  if (!hydrated) return <LoadingState />;

  const hour = new Date().getHours();
  const dateLine = capitalize(formatLongDate(selected));
  const taskRow = (task: Task, i: number) => {
    const cal = task.calendar_id ? calendarsMap[task.calendar_id] : undefined;
    return (
      <EnterItem key={task.id} index={i}>
        <TaskRow
          task={task}
          today={today}
          timeFormat={display.timeFormat}
          calendarName={cal?.name}
          calendarColor={cal?.color}
          assignee={task.assignee_id ? (people[task.assignee_id] ?? null) : null}
          onPress={openTask}
          onToggle={(x) => void toggle(x)}
          onLongPress={openMenu}
          compact
        />
      </EnterItem>
    );
  };
  const nothing = !list.length && !dayTasks.length && !overdue.length && !reminders.length;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl }]}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => void syncNow()} />}
      >
        <View style={styles.column}>
          <OrbitRings
            size={decor}
            paused={!focused}
            style={[styles.decor, { right: -decor * 0.34, top: -decor * 0.42 }]}
          />
          <View style={styles.header}>
            <View style={[styles.flex, { paddingRight: spacing.sm }]}>
              <AppText variant="overline" tone="muted" accessibilityRole="text">
                {dateLine}
              </AppText>
              <AppText variant="title" style={styles.greeting} numberOfLines={2}>
                {isToday ? greeting(name, hour) : capitalize(formatLongDate(selected).split(',')[0])}
              </AppText>
            </View>
            <View>
              <IconButton
                icon={unread ? 'notifications-unread' : 'notifications-outline'}
                label={unread ? t('tabs.notificationsUnread', { n: unread }) : t('tabs.notifications')}
                filled
                onPress={() => router.push('/notifications')}
              />
            </View>
          </View>

          <WeekStrip days={days} selected={selected} today={today} busy={busy} onSelect={setSelected} />

          <View style={styles.pillRow}>
            <SyncPill calendars={active} />
            {!isToday && (
              <PressableScale
                onPress={() => setSelected(today)}
                accessibilityRole="button"
                accessibilityLabel={t('calendarView.goToToday')}
                style={[styles.pill, { borderColor: colors.border, borderWidth: 1 }]}
              >
                <Icon name="today-outline" size={16} color={colors.text} />
                <AppText variant="label">{t('common.today')}</AppText>
              </PressableScale>
            )}
          </View>

          {isToday && (
            <Card
              onPress={() => router.push('/plan-day')}
              accessibilityLabel={
                checkedIn ? t('planDay.title') : `${t('planDay.open')}. ${t('planDay.openHint')}`
              }
              style={[styles.planCard, { backgroundColor: colors.primarySoft }]}
            >
              <View style={[styles.planIcon, { backgroundColor: colors.primary }]}>
                <Icon name="sunny-outline" size={22} color={colors.primaryText} />
              </View>
              <View style={styles.flex}>
                <AppText variant="heading" style={{ color: colors.primaryInk }}>
                  {checkedIn ? t('planDay.title') : t('planDay.question')}
                </AppText>
                <AppText variant="small" tone="muted">
                  {checkedIn
                    ? t('planDay.summary', { n: dayTasks.length + list.length })
                    : t('planDay.openHint')}
                </AppText>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.primaryInk} />
            </Card>
          )}

          {nextOcc && <NextUp occ={nextOcc} now={now} timezone={tz} />}

          {calendars.length === 0 ? (
            <EmptyState
              art="orbit"
              title={t('calendars.emptyTitle')}
              message={t('calendars.emptyMessage')}
              actionLabel={t('calendars.new')}
              onAction={() => router.push('/calendar/new')}
            />
          ) : nothing ? (
            <EmptyState
              art="kairo"
              title={t('today.emptyTitle')}
              message={t('today.emptyMessage')}
              actionLabel={t('create.title')}
              onAction={() => router.push({ pathname: '/create', params: { date: selected } })}
            />
          ) : null}

          {list.length > 0 && (
            <Section id="agenda" title={t('todayHub.agenda')} count={list.length} icon="calendar-outline">
              <View style={styles.list} key={selected}>
                {list.map((occ, i) => (
                  <EnterItem key={occ.key} index={i}>
                    <EventRow
                      occurrence={occ}
                      calendarName={calendarsMap[occ.event.calendar_id]?.name}
                      calendarColor={calendarsMap[occ.event.calendar_id]?.color}
                      timezone={tz}
                      timeFormat={display.timeFormat}
                      dateFormat={display.dateFormat}
                      conflict={conflicts.has(occ.key)}
                      onPress={openEvent}
                    />
                  </EnterItem>
                ))}
              </View>
            </Section>
          )}

          {(dayTasks.length > 0 || isToday) && !nothing && (
            <Section id="tasks" title={t('todayHub.dueToday')} count={dayTasks.length} icon="task-outline">
              {dayTasks.length ? (
                <View style={styles.list}>{dayTasks.map(taskRow)}</View>
              ) : (
                <AppText variant="small" tone="muted">
                  {t('todayHub.nothingDue')}
                </AppText>
              )}
            </Section>
          )}

          {overdue.length > 0 && (
            <Section
              id="overdue"
              title={t('todayHub.overdue')}
              count={overdue.length}
              icon="alert-circle-outline"
              tone="danger"
              defaultCollapsed={overdue.length > 3}
            >
              <View style={styles.list}>{overdue.slice(0, 10).map(taskRow)}</View>
              {overdue.length > 10 && (
                <Chip label={t('common.seeAll')} selected={false} onPress={() => router.push('/tasks')} />
              )}
            </Section>
          )}

          {reminders.length > 0 && (
            <Section
              id="reminders"
              title={t('todayHub.reminders')}
              count={reminders.length}
              icon="notifications-outline"
            >
              <View style={styles.list}>{reminders.map(taskRow)}</View>
            </Section>
          )}

          {isToday && recent.length > 0 && (
            <Section id="shared" title={t('todayHub.shared')} count={recent.length} icon="group-outline">
              {recent.map((n) => (
                <PressableScale
                  key={n.id}
                  onPress={() => router.push('/notifications')}
                  accessibilityRole="button"
                  accessibilityLabel={`${n.title}. ${n.body ?? ''}`}
                  style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.unreadDot, { backgroundColor: colors.coral }]} />
                  <View style={styles.flex}>
                    <AppText variant="label" numberOfLines={1}>
                      {n.title}
                    </AppText>
                    {n.body ? (
                      <AppText variant="caption" tone="muted" numberOfLines={1}>
                        {n.body}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText variant="caption" tone="muted">
                    {formatRelative(new Date(n.created_at), now, tz, display.dateFormat)}
                  </AppText>
                </PressableScale>
              ))}
            </Section>
          )}

          {(list.length > 0 || dayTasks.length > 0) && (
            <Section
              id="free"
              title={t('todayHub.freeSlots')}
              count={slots.length}
              icon="time-outline"
              defaultCollapsed
            >
              {slots.length ? (
                <View style={styles.chips}>
                  {slots.map((s) => (
                    <Chip
                      key={s.start.toISOString()}
                      label={`${formatTime(s.start, tz, display.timeFormat)} a ${formatTime(s.end, tz, display.timeFormat)}`}
                      selected={false}
                      onPress={() =>
                        router.push({
                          pathname: '/create',
                          params: { date: selected },
                        })
                      }
                    />
                  ))}
                </View>
              ) : (
                <AppText variant="small" tone="muted">
                  {t('todayHub.freeSlotsEmpty')}
                </AppText>
              )}
            </Section>
          )}

          <Card
            onPress={() => router.push('/week')}
            accessibilityLabel={t('todayHub.weekSummary')}
            style={styles.weekCard}
          >
            <Icon name="sparkles-outline" size={22} color={colors.primaryInk} />
            <View style={styles.flex}>
              <AppText variant="heading">{t('todayHub.weekSummary')}</AppText>
              <AppText variant="small" tone="muted">
                {t('todayHub.weekSummaryHint')}
              </AppText>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.textMuted} />
          </Card>
        </View>
      </ScrollView>
      <FAB
        label={t('create.title')}
        onPress={() => router.push({ pathname: '/create', params: { date: selected } })}
      />
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: SCREEN_MARGIN, paddingBottom: 120 },
  column: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', gap: spacing.lg },
  decor: { position: 'absolute', opacity: 0.9 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  greeting: { fontSize: 26, lineHeight: 32, marginTop: spacing.xs },
  week: { flexDirection: 'row', marginHorizontal: -spacing.xs },
  bubble: { position: 'absolute', top: 0, bottom: 0, borderRadius: radius.pill },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, gap: 2, minHeight: 64 },
  weekNum: { fontSize: 18, lineHeight: 24, ...fonte('negrito'), fontVariant: ['tabular-nums'] },
  weekDot: { width: 5, height: 5, borderRadius: 3 },
  pillRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md + 2,
    minHeight: 36,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  list: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 36 },
  sectionBody: { gap: spacing.sm },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  planIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  next: { gap: spacing.xs },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  weekCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
