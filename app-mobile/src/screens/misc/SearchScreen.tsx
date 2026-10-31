import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EventRow } from '@/components/EventRow';
import { Icon } from '@/components/Icon';
import { OfflineBanner } from '@/components/OfflineBanner';
import { TaskRow } from '@/components/TaskRow';
import { TextField } from '@/components/TextField';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useCalendarsMap, useEventsMap } from '@/hooks/useEventsView';
import { useLists, useNotes, useTasks } from '@/hooks/useItems';
import { useTaskActions } from '@/hooks/useTaskActions';
import { t } from '@/i18n';
import type { Calendar, CalendarEvent, Note, Occurrence, Task } from '@/models/types';
import * as api from '@/services/api';
import { useSyncStore } from '@/stores/syncStore';
import { useUiStore } from '@/stores/uiStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, radius, spacing } from '@/theme/tokens';
import { todayKey } from '@/utils/dates';
import { applyFilters, searchOccurrences } from '@/utils/filters';
import { expandEvent, sortOccurrences } from '@/utils/recurrence';
import { isSearchable, parseSearch, searchCalendars, searchNotes, searchTasks } from '@/utils/search';
import { truncate } from '@/utils/text';
import { CONTENT_MAX_WIDTH } from '@/utils/layout';

type Category = 'all' | 'events' | 'tasks' | 'reminders' | 'notes' | 'calendars';
const CATEGORIES: Category[] = ['all', 'events', 'tasks', 'reminders', 'notes', 'calendars'];

type Row =
  | { kind: 'event'; key: string; occurrence: Occurrence }
  | { kind: 'task'; key: string; task: Task }
  | { kind: 'note'; key: string; note: Note }
  | { kind: 'calendar'; key: string; calendar: Calendar };

/** Uma ocorrência representativa de cada evento encontrado (a próxima, ou a última). */
function representative(event: CalendarEvent, now: Date): Occurrence | undefined {
  const start = new Date(event.starts_at);
  const next = expandEvent(event, now, new Date(now.getTime() + 400 * 86_400_000))[0];
  return next ?? expandEvent(event, start, new Date(start.getTime() + 2 * 86_400_000))[0];
}

/**
 * Busca em tudo: eventos no servidor quando há internet (só o que a pessoa
 * pode ver) ou no aparelho; tarefas, lembretes, anotações e agendas no aparelho.
 */
export default function SearchScreen() {
  const { colors, dark } = useAppTheme();
  const display = useDisplaySettings();
  const online = useSyncStore((s) => s.online);
  const filters = useUiStore((s) => s.filters);
  const calendars = useCalendarsMap();
  const localEvents = useEventsMap();
  const tasks = useTasks();
  const lists = useLists();
  const notes = useNotes();
  const { toggle, openMenu, sheet } = useTaskActions();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [includeDone, setIncludeDone] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [remoteResult, setRemoteResult] = useState<{ query: string; list: CalendarEvent[] | null } | null>(
    null,
  );
  const today = todayKey(display.timezone);

  // Espera a pessoa parar de digitar (debounce) para não chamar o servidor a cada letra.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const searchable = isSearchable(debounced);
  const textOnly = parseSearch(debounced).tags.length === 0;
  const searchRemote = online && searchable && textOnly && (category === 'all' || category === 'events');
  useEffect(() => {
    if (!searchRemote) return;
    let alive = true;
    api
      .searchEvents(debounced, 100)
      .then((list) => alive && setRemoteResult({ query: debounced, list }))
      .catch(() => alive && setRemoteResult({ query: debounced, list: null }));
    return () => {
      alive = false;
    };
  }, [debounced, searchRemote]);

  const remote = searchRemote && remoteResult?.query === debounced ? remoteResult.list : null;
  const loading = searchRemote && remoteResult?.query !== debounced;

  const sections = useMemo(() => {
    if (!searchable) return [];
    const now = new Date();
    const want = (c: Category) => category === 'all' || category === c;
    const out: { key: string; title: string; data: Row[] }[] = [];
    if (want('events') && textOnly && !onlyOverdue) {
      const names = Object.fromEntries(Object.values(calendars).map((c) => [c.id, c.name]));
      const cols = Object.fromEntries(Object.values(calendars).map((c) => [c.id, c.color]));
      const base = remote
        ? remote.map((e) => representative(e, now)).filter((o): o is Occurrence => !!o)
        : searchOccurrences(
            Object.values(localEvents)
              .map((e) => representative(e, now))
              .filter((o): o is Occurrence => !!o),
            debounced,
            names,
          );
      const found = sortOccurrences(applyFilters(base, filters, null, cols, now));
      if (found.length)
        out.push({
          key: 'events',
          title: t('search.events'),
          data: found.slice(0, 60).map((o) => ({ kind: 'event', key: `e:${o.key}`, occurrence: o })),
        });
    }
    const listMap = Object.fromEntries(lists.map((l) => [l.id, l]));
    const foundTasks = searchTasks(
      tasks,
      debounced,
      { includeDone, onlyOverdue, today },
      { lists: listMap, calendars },
    );
    for (const type of ['tasks', 'reminders'] as const) {
      if (!want(type)) continue;
      const data = foundTasks.filter((x) =>
        type === 'tasks' ? x.item_type === 'task' : x.item_type === 'reminder',
      );
      if (data.length)
        out.push({
          key: type,
          title: t(`search.${type}`),
          data: data.slice(0, 60).map((x) => ({ kind: 'task', key: `t:${x.id}`, task: x })),
        });
    }
    if (want('notes') && !onlyOverdue) {
      const data = searchNotes(notes, debounced);
      if (data.length)
        out.push({
          key: 'notes',
          title: t('search.notes'),
          data: data.slice(0, 40).map((n) => ({ kind: 'note', key: `n:${n.id}`, note: n })),
        });
    }
    if (want('calendars') && !onlyOverdue) {
      const data = searchCalendars(Object.values(calendars), debounced);
      if (data.length)
        out.push({
          key: 'calendars',
          title: t('search.calendars'),
          data: data.map((c) => ({ kind: 'calendar', key: `c:${c.id}`, calendar: c })),
        });
    }
    return out;
  }, [
    searchable,
    textOnly,
    category,
    debounced,
    remote,
    localEvents,
    calendars,
    filters,
    tasks,
    lists,
    notes,
    includeDone,
    onlyOverdue,
    today,
  ]);

  const total = sections.reduce((n, s) => n + s.data.length, 0);

  const renderRow = (row: Row) => {
    switch (row.kind) {
      case 'event':
        return (
          <EventRow
            occurrence={row.occurrence}
            calendarName={calendars[row.occurrence.event.calendar_id]?.name}
            calendarColor={calendars[row.occurrence.event.calendar_id]?.color}
            timezone={display.timezone}
            timeFormat={display.timeFormat}
            dateFormat={display.dateFormat}
            onPress={(o) =>
              router.push({ pathname: '/event/[id]', params: { id: o.event.id, date: o.originalDate } })
            }
          />
        );
      case 'task': {
        const cal = row.task.calendar_id ? calendars[row.task.calendar_id] : undefined;
        return (
          <TaskRow
            task={row.task}
            today={today}
            timeFormat={display.timeFormat}
            calendarName={cal?.name}
            calendarColor={cal?.color}
            onPress={(x) => router.push({ pathname: '/task/[id]', params: { id: x.id } })}
            onToggle={(x) => void toggle(x)}
            onLongPress={openMenu}
          />
        );
      }
      case 'note':
        return (
          <Card
            onPress={() => router.push({ pathname: '/notes/[id]', params: { id: row.note.id } })}
            style={styles.line}
          >
            <Icon name="leaf-outline" size={18} color={colors.primaryInk} />
            <View style={styles.flex}>
              <AppText variant="bodyMd" numberOfLines={1}>
                {row.note.title || truncate(row.note.body.split('\n')[0] ?? '', 60)}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {truncate(row.note.body.replace(/\s+/g, ' '), 90)}
              </AppText>
            </View>
          </Card>
        );
      case 'calendar':
        return (
          <Card
            onPress={() => router.push({ pathname: '/calendar/[id]', params: { id: row.calendar.id } })}
            style={styles.line}
          >
            <View style={[styles.swatch, { backgroundColor: agendaColor(row.calendar.color, dark) }]} />
            <AppText variant="bodyMd" style={styles.flex} numberOfLines={1}>
              {row.calendar.name}
            </AppText>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        );
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t('search.title') }} />
      <OfflineBanner />
      <View style={styles.header}>
        <TextField
          label={t('search.title')}
          placeholder={t('search.placeholder')}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          hint={!isSearchable(query) ? t('search.hint') : !online ? t('search.offlineNotice') : undefined}
        />
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={t(`search.${c}`)} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
        <View style={styles.chips}>
          <Chip
            label={t('search.includeDone')}
            selected={includeDone}
            onPress={() => setIncludeDone(!includeDone)}
          />
          <Chip
            label={t('search.onlyOverdue')}
            selected={onlyOverdue}
            onPress={() => setOnlyOverdue(!onlyOverdue)}
          />
        </View>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          searchable ? (
            <AppText variant="small" tone="muted" accessibilityLiveRegion="polite">
              {loading && !total ? t('common.loading') : t('search.results', { n: total })}
            </AppText>
          ) : (
            <AppText variant="small" tone="muted">
              {t('search.suggestions')}
            </AppText>
          )
        }
        ListEmptyComponent={
          searchable && !loading ? (
            <AppText tone="muted">{t('search.noResultsAny', { q: debounced })}</AppText>
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <AppText variant="overline" tone="muted" style={styles.section} accessibilityRole="header">
            {`${section.title} · ${section.data.length}`}
          </AppText>
        )}
        renderItem={({ item }) => <View style={styles.item}>{renderRow(item)}</View>}
      />
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Busca e resultados numa coluna centralizada em telas largas.
  header: {
    padding: spacing.lg,
    paddingBottom: 0,
    gap: spacing.sm,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  list: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  section: { marginTop: spacing.md, marginBottom: spacing.xs },
  item: { marginBottom: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  swatch: { width: 18, height: 18, borderRadius: radius.sm },
});
