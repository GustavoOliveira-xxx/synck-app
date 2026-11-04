// Aba Tarefas: adição rápida, visões inteligentes (Hoje, Próximos 7 dias,
// Atrasadas...), listas e as tarefas e lembretes da visão escolhida. Em telas
// largas, as visões ficam numa coluna à esquerda.
import { router } from '@/services/router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { FAB } from '@/components/FAB';
import { useFeedback } from '@/components/Feedback';
import { Icon, type IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { EnterItem, PressableScale } from '@/components/motion';
import { OfflineBanner } from '@/components/OfflineBanner';
import { OptionSheet } from '@/components/OptionSheet';
import { QuickAddBar } from '@/components/QuickAddBar';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { TaskRow } from '@/components/TaskRow';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useCalendarsMap } from '@/hooks/useEventsView';
import { useLists, useTasks } from '@/hooks/useItems';
import { useLayout } from '@/hooks/useLayout';
import { usePeople, useSharedMembers } from '@/hooks/usePeople';
import { useTaskActions } from '@/hooks/useTaskActions';
import { strings, t } from '@/i18n';
import type { Task } from '@/models/types';
import { syncNow } from '@/offline/syncEngine';
import * as api from '@/services/api';
import { deleteList } from '@/services/itemActions';
import { useUserId } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { useUiStore, type TaskViewKey } from '@/stores/uiStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, radius, SCREEN_MARGIN, spacing } from '@/theme/tokens';
import { capitalize, formatLongDate, todayKey } from '@/utils/dates';
import { CONTENT_MAX_WIDTH } from '@/utils/layout';
import {
  activeTaskFilterCount,
  inView,
  isOverdue,
  matchesFilters,
  SMART_VIEWS,
  sortTasks,
  TASK_SORTS,
  viewCounts,
  type SmartView,
  type TaskSort,
  type ViewContext,
} from '@/utils/tasks';

const VIEW_ICONS: Record<SmartView, IconName> = {
  inbox: 'inbox-outline',
  today: 'sunny-outline',
  upcoming: 'calendar-outline',
  week: 'grid-outline',
  overdue: 'alert-circle-outline',
  nodate: 'circle-outline',
  important: 'flag-outline',
  assigned: 'person-outline',
  shared: 'group-outline',
  reminders: 'notifications-outline',
  done: 'checkmark-circle-outline',
};

interface Section {
  key: string;
  title: string;
  data: Task[];
}

function ViewButton({
  icon,
  label,
  count,
  selected,
  color,
  onPress,
}: {
  icon: IconName;
  label: string;
  count?: number;
  selected: boolean;
  color?: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={count ? `${label}, ${count}` : label}
      style={[styles.sideItem, selected && { backgroundColor: colors.primarySoft }]}
    >
      {color ? (
        <View style={[styles.listDot, { backgroundColor: color }]} />
      ) : (
        <Icon name={icon} size={20} color={selected ? colors.primaryInk : colors.textMuted} />
      )}
      <AppText
        variant="label"
        numberOfLines={1}
        style={[styles.flex, { color: selected ? colors.primaryInk : colors.text }]}
      >
        {label}
      </AppText>
      {count ? (
        <AppText variant="caption" tone="muted">
          {count}
        </AppText>
      ) : null}
    </PressableScale>
  );
}

export default function TasksScreen() {
  const { colors, dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { twoPane } = useLayout();
  const display = useDisplaySettings();
  const { toast, confirm } = useFeedback();
  const today = todayKey(display.timezone);
  const userId = useUserId();
  const hydrated = useDataStore((s) => s.hydrated);
  const syncing = useSyncStore((s) => s.syncing);
  const online = useSyncStore((s) => s.online);
  const tasks = useTasks();
  const lists = useLists();
  const calendars = useCalendarsMap();
  const people = usePeople();
  useSharedMembers();

  const view = useUiStore((s) => s.taskView);
  const setView = useUiStore((s) => s.setTaskView);
  const sort = useUiStore((s) => s.taskSort);
  const setSort = useUiStore((s) => s.setTaskSort);
  const filters = useUiStore((s) => s.taskFilters);
  const [sortOpen, setSortOpen] = useState(false);
  const [listMenu, setListMenu] = useState(false);
  const [olderDone, setOlderDone] = useState<Task[]>([]);
  const [loadingDone, setLoadingDone] = useState(false);

  const ctx: ViewContext = useMemo(
    () => ({ today, now: new Date(), userId, weekStartsOn: display.weekStartsOn }),
    [today, userId, display.weekStartsOn],
  );
  const counts = useMemo(() => viewCounts(tasks, ctx), [tasks, ctx]);
  const listMap = useMemo(() => Object.fromEntries(lists.map((l) => [l.id, l])), [lists]);
  const currentList = view.startsWith('list:') ? listMap[view.slice(5)] : undefined;
  const activeView: TaskViewKey = view.startsWith('list:') && !currentList ? 'today' : view;

  const visible = useMemo(() => {
    const base =
      activeView === 'done'
        ? [...tasks, ...olderDone.filter((d) => !tasks.some((x) => x.id === d.id))]
        : tasks;
    return base.filter((task) => inView(task, activeView, ctx) && matchesFilters(task, filters, ctx));
  }, [tasks, olderDone, activeView, ctx, filters]);

  const sections: Section[] = useMemo(() => {
    if (activeView === 'done') {
      return [{ key: 'done', title: '', data: sortTasks(visible, 'updated') }];
    }
    const sorted = sortTasks(visible, sort);
    if (activeView === 'today') {
      const late = sorted.filter((x) => isOverdue(x, today, ctx.now) && x.due_date !== today);
      const due = sorted.filter((x) => x.due_date === today);
      const planned = sorted.filter((x) => !late.includes(x) && !due.includes(x));
      return [
        { key: 'late', title: t('todayHub.overdue'), data: late },
        { key: 'due', title: t('todayHub.dueToday'), data: due },
        { key: 'planned', title: t('todayHub.myDay'), data: planned },
      ].filter((s) => s.data.length);
    }
    if (activeView === 'upcoming' || (activeView === 'week' && sort === 'due')) {
      const byDay = new Map<string, Task[]>();
      for (const x of sorted) byDay.set(x.due_date ?? '', [...(byDay.get(x.due_date ?? '') ?? []), x]);
      return [...byDay.entries()].map(([day, data]) => ({
        key: day,
        title: day ? capitalize(formatLongDate(day)) : t('tasks.noDate'),
        data,
      }));
    }
    return [{ key: 'all', title: '', data: sorted }];
  }, [visible, sort, activeView, today, ctx.now]);

  const ordered = sort === 'manual' ? sections.flatMap((s) => s.data) : undefined;
  const { toggle, openMenu, sheet } = useTaskActions({ ordered });
  const openTask = useCallback(
    (task: Task) => router.push({ pathname: '/task/[id]', params: { id: task.id } }),
    [],
  );
  const nFilters = activeTaskFilterCount(filters);

  const loadOlderDone = async () => {
    if (!online) {
      toast(t('common.requiresInternet'), 'error');
      return;
    }
    setLoadingDone(true);
    try {
      const all = [...tasks.filter((x) => x.status === 'done' || x.status === 'cancelled'), ...olderDone];
      const oldest = all.map((x) => x.updated_at).sort()[0] ?? null;
      const page = await api.listDoneTasks(oldest);
      setOlderDone((prev) => [...prev, ...page.filter((p) => !prev.some((q) => q.id === p.id))]);
    } catch {
      toast(t('errors.generic'), 'error');
    } finally {
      setLoadingDone(false);
    }
  };

  const removeList = async () => {
    setListMenu(false);
    if (!currentList) return;
    const ok = await confirm({
      title: t('tasks.listDeleteTitle', { name: currentList.name }),
      message: t('tasks.listDeleteMessage'),
      destructive: true,
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    await deleteList(currentList);
    setView('inbox');
    toast(t('tasks.listDeleted'));
  };

  const viewTitle = currentList ? currentList.name : strings.tasks.views[activeView as SmartView];

  const viewPicker = (vertical: boolean) => {
    const smart = SMART_VIEWS.map((v) => (
      <ViewButtonOrChip
        key={v}
        vertical={vertical}
        icon={VIEW_ICONS[v]}
        label={strings.tasks.views[v]}
        count={v === 'done' ? undefined : counts[v]}
        selected={activeView === v}
        onPress={() => setView(v)}
      />
    ));
    const listItems = lists.map((l) => {
      const cal = l.calendar_id ? calendars[l.calendar_id] : undefined;
      const color = agendaColor(l.color ?? cal?.color, dark) ?? colors.primary;
      return (
        <ViewButtonOrChip
          key={l.id}
          vertical={vertical}
          icon="list-outline"
          color={color}
          label={cal ? `${l.name} · ${cal.name}` : l.name}
          count={tasks.filter((x) => x.list_id === l.id && inView(x, `list:${l.id}`, ctx)).length}
          selected={activeView === `list:${l.id}`}
          onPress={() => setView(`list:${l.id}`)}
        />
      );
    });
    const newList = (
      <ViewButtonOrChip
        key="new-list"
        vertical={vertical}
        icon="add"
        label={t('tasks.newList')}
        selected={false}
        onPress={() => router.push('/list/new')}
      />
    );
    return { smart, listItems, newList };
  };

  const chipPicker = twoPane ? null : viewPicker(false);
  const sidePicker = twoPane ? viewPicker(true) : null;

  const links = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.links}
      style={styles.linksScroll}
    >
      <Button
        title={t('tasks.habitsLink')}
        icon="leaf-outline"
        variant="tonal"
        compact
        onPress={() => router.push('/habits')}
      />
      <Button
        title={t('tasks.notesLink')}
        icon="document-text-outline"
        variant="tonal"
        compact
        onPress={() => router.push('/notes')}
      />
      <Button
        title={t('tasks.plannerLink')}
        icon="sparkles-outline"
        variant="tonal"
        compact
        onPress={() => router.push('/planner')}
      />
    </ScrollView>
  );

  const header = (
    <View style={styles.headerBlock}>
      <View style={[styles.titleRow, { paddingTop: insets.top + spacing.md }]}>
        <AppText variant="title" style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {twoPane ? viewTitle : t('tasks.title')}
        </AppText>
        <IconButton icon="search" label={t('common.search')} onPress={() => router.push('/search')} />
        <IconButton
          icon="options-outline"
          label={`${t('tasks.sort')}: ${strings.tasks.sorts[sort]}`}
          onPress={() => setSortOpen(true)}
        />
        <IconButton
          icon={nFilters ? 'funnel' : 'funnel-outline'}
          label={
            nFilters ? `${t('tasks.filter')}, ${t('filters.active', { n: nFilters })}` : t('tasks.filter')
          }
          onPress={() => router.push('/task-filters')}
          color={nFilters ? colors.primaryInk : undefined}
        />
        {currentList && (
          <IconButton icon="ellipsis-horizontal" label={currentList.name} onPress={() => setListMenu(true)} />
        )}
      </View>
      <QuickAddBar
        listId={currentList?.id ?? null}
        calendarId={currentList?.calendar_id ?? null}
        planDay={activeView === 'today' ? today : null}
      />
      {chipPicker && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chipPicker.smart}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chipPicker.listItems}
            {chipPicker.newList}
          </ScrollView>
          {links}
          <AppText variant="overline" tone="muted" accessibilityRole="header" style={styles.viewTitle}>
            {`${viewTitle} · ${visible.length}`}
          </AppText>
        </>
      )}
    </View>
  );

  if (!hydrated) return <LoadingState />;

  const list = (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={[styles.scroll, styles.column]}
      refreshControl={
        <RefreshControl refreshing={syncing} onRefresh={() => void syncNow()} tintColor={colors.primary} />
      }
      initialNumToRender={20}
      windowSize={9}
      renderSectionHeader={({ section }) =>
        section.title ? (
          <AppText
            variant="overline"
            tone={section.key === 'late' ? 'danger' : 'muted'}
            style={styles.section}
            accessibilityRole="header"
          >
            {`${section.title} · ${section.data.length}`}
          </AppText>
        ) : null
      }
      renderItem={({ item, index }) => {
        const cal = item.calendar_id ? calendars[item.calendar_id] : undefined;
        const assignee = item.assignee_id ? (people[item.assignee_id] ?? null) : null;
        return (
          <EnterItem index={index} style={styles.item}>
            <TaskRow
              task={item}
              today={today}
              timeFormat={display.timeFormat}
              calendarName={cal?.name}
              calendarColor={cal?.color}
              listName={item.list_id ? listMap[item.list_id]?.name : undefined}
              hideList={!!currentList}
              assignee={assignee}
              onPress={openTask}
              onToggle={(x) => void toggle(x)}
              onLongPress={openMenu}
            />
          </EnterItem>
        );
      }}
      ListEmptyComponent={
        <EmptyState
          art={activeView === 'done' ? 'sphere' : 'kairo'}
          title={activeView === 'done' ? t('tasks.emptyDone') : t('tasks.emptyTitle')}
          message={activeView === 'done' ? undefined : t('tasks.emptyMessage')}
        />
      }
      ListFooterComponent={
        activeView === 'done' ? (
          <Button
            title={t('tasks.loadMoreDone')}
            variant="ghost"
            icon="refresh"
            loading={loadingDone}
            onPress={() => void loadOlderDone()}
          />
        ) : undefined
      }
    />
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      {sidePicker ? (
        <View style={styles.panes}>
          <ScrollView
            style={[styles.side, { borderRightColor: colors.border }]}
            contentContainerStyle={{ paddingTop: insets.top + spacing.xl, padding: spacing.md, gap: 2 }}
          >
            <AppText variant="title" style={styles.sideTitle} accessibilityRole="header">
              {t('tasks.title')}
            </AppText>
            {sidePicker.smart}
            <AppText variant="overline" tone="muted" style={styles.sideSection}>
              {t('tasks.lists')}
            </AppText>
            {sidePicker.listItems}
            {sidePicker.newList}
            <View style={{ marginTop: spacing.lg }}>{links}</View>
          </ScrollView>
          <View style={styles.flex}>{list}</View>
        </View>
      ) : (
        list
      )}
      <FAB
        label={t('tasks.new')}
        onPress={() =>
          router.push({
            pathname: '/task/new',
            params: {
              listId: currentList?.id ?? '',
              calendarId: currentList?.calendar_id ?? '',
              type: activeView === 'reminders' ? 'reminder' : 'task',
              plan: activeView === 'today' ? today : '',
            },
          })
        }
      />
      {sheet}
      <OptionSheet<TaskSort>
        visible={sortOpen}
        title={t('tasks.sort')}
        options={TASK_SORTS.map((s) => ({ value: s, label: strings.tasks.sorts[s] }))}
        value={sort}
        onSelect={(s) => {
          setSort(s);
          setSortOpen(false);
        }}
        onClose={() => setSortOpen(false)}
      />
      <OptionSheet<'rename' | 'delete' | null>
        visible={listMenu}
        title={currentList?.name ?? ''}
        options={[
          { value: 'rename', label: t('tasks.listRename') },
          { value: 'delete', label: t('common.delete') },
        ]}
        value={null}
        onSelect={(v) => {
          setListMenu(false);
          if (v === 'rename' && currentList)
            router.push({ pathname: '/list/[id]', params: { id: currentList.id } });
          if (v === 'delete') void removeList();
        }}
        onClose={() => setListMenu(false)}
      />
    </View>
  );
}

function ViewButtonOrChip(props: {
  vertical: boolean;
  icon: IconName;
  label: string;
  count?: number;
  selected: boolean;
  color?: string;
  onPress: () => void;
}) {
  if (props.vertical) return <ViewButton {...props} />;
  return (
    <Chip
      label={props.count ? `${props.label} · ${props.count}` : props.label}
      selected={props.selected}
      color={props.color}
      onPress={props.onPress}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: SCREEN_MARGIN, paddingBottom: 120 },
  column: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  headerBlock: { gap: spacing.md, marginBottom: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { flex: 1, fontSize: 26, lineHeight: 32 },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  links: { flexDirection: 'row', gap: spacing.sm },
  linksScroll: { flexGrow: 0 },
  viewTitle: { marginTop: spacing.xs },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  item: { marginBottom: spacing.sm },
  panes: { flex: 1, flexDirection: 'row' },
  side: { width: 280, flexGrow: 0, borderRightWidth: StyleSheet.hairlineWidth },
  sideTitle: { marginBottom: spacing.md, marginLeft: spacing.sm },
  sideSection: { marginTop: spacing.lg, marginBottom: spacing.xs, marginLeft: spacing.sm },
  sideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.pill,
  },
  listDot: { width: 12, height: 12, borderRadius: 6, marginHorizontal: 4 },
});
