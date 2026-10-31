// Agendas: cartões com a inicial da agenda, papel, próximo compromisso e os
// avatares de quem participa. Filtros em chips e anéis de órbita no topo.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { AvatarStack } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { OrbitRings, useDecorSize } from '@/components/brand/Decor';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { FAB } from '@/components/FAB';
import { IconButton } from '@/components/IconButton';
import { Icon } from '@/components/Icon';
import { EnterItem, PressableScale } from '@/components/motion';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Cascade } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/StateViews';
import { useCalendarMembers } from '@/hooks/useCalendarMembers';
import { useDisplaySettings, type DisplaySettings } from '@/hooks/useDisplaySettings';
import { useNow } from '@/hooks/useNow';
import { useOccurrences } from '@/hooks/useEventsView';
import { useRemoteData } from '@/hooks/useRemoteData';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { strings, t } from '@/i18n';
import type { Calendar, Occurrence } from '@/models/types';
import { syncNow } from '@/offline/syncEngine';
import * as api from '@/services/api';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, fonte, mix, pastel, radius, SCREEN_MARGIN, spacing } from '@/theme/tokens';
import { addDaysToKey, capitalize, formatShortDate, formatTime, todayKey, toDateKey } from '@/utils/dates';
import { CONTENT_MAX_WIDTH } from '@/utils/layout';
import { canCreateEvents } from '@/utils/permissions';

type Filter = 'all' | 'shared' | 'mine';

function whenLabel(occ: Occurrence, display: DisplaySettings, now: number): string {
  const tz = display.timezone;
  const today = todayKey(tz);
  const day = occ.allDay && occ.startDate ? occ.startDate : toDateKey(occ.start, tz);
  const dayText =
    day === today
      ? t('common.today')
      : day === addDaysToKey(today, 1)
        ? t('calendars.tomorrow')
        : capitalize(strings.weekdays.short[new Date(`${day}T12:00:00Z`).getUTCDay()]) +
          ` ${formatShortDate(day)}`;
  if (occ.start.getTime() <= now && !occ.allDay) return t('today.now');
  return occ.allDay ? dayText : `${dayText} ${formatTime(occ.start, tz, display.timeFormat)}`;
}

function CalendarCard({
  calendar,
  next,
  display,
  now = 0,
}: {
  calendar: Calendar;
  next?: Occurrence;
  display: DisplaySettings;
  now?: number;
}) {
  const { colors, dark } = useAppTheme();
  const members = useCalendarMembers(calendar.id);
  const color = agendaColor(calendar.color, dark) ?? colors.primary;
  const base = agendaColor(calendar.color, false) ?? colors.primary;
  const initial = calendar.name.trim().charAt(0).toUpperCase() || '?';
  const people = members.map((m) => ({ name: m.display_name, color: m.avatar_color }));
  const subtitle = [
    strings.calendarKinds[calendar.kind],
    t('calendars.people', { n: calendar.member_count }),
  ].join(' · ');
  const nextText = next
    ? `${whenLabel(next, display, now)} · ${next.event.is_masked ? t('events.maskedTitle') : (next.title ?? '')}`
    : t('calendars.nothingNext');
  const archived = calendar.status === 'archived';
  return (
    <Card
      onPress={() => router.push({ pathname: '/calendar/[id]', params: { id: calendar.id } })}
      accessibilityLabel={`${calendar.name}. ${subtitle}. ${strings.roles[calendar.my_role]}. ${nextText}`}
      style={styles.card}
    >
      <View style={styles.cardTop}>
        <View
          style={[styles.tile, { backgroundColor: dark ? mix(base, colors.surface, 0.55) : pastel(base) }]}
        >
          <AppText style={[styles.initial, { color: dark ? colors.text : mix(base, colors.text, 0.3) }]}>
            {initial}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="heading" numberOfLines={1}>
            {calendar.name}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        </View>
        <Badge
          label={strings.roles[calendar.my_role]}
          tone={calendar.my_role === 'owner' ? 'primary' : 'neutral'}
        />
      </View>
      <View style={styles.cardBottom}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <AppText variant="caption" tone="muted" numberOfLines={2} style={styles.flex}>
          {archived ? t('calendars.archivedBadge') : nextText}
        </AppText>
        <AvatarStack people={people} max={2} size={28} />
        {!archived && !calendar.deleted_at && canCreateEvents(calendar) && (
          <PressableScale
            onPress={() => router.push({ pathname: '/event/new', params: { calendarId: calendar.id } })}
            haptic
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('calendars.addEventIn', { name: calendar.name })}
            style={[styles.add, { backgroundColor: colors.primarySoft }]}
          >
            <Icon name="add" size={18} color={colors.primaryInk} strokeWidth={2.4} />
          </PressableScale>
        )}
      </View>
    </Card>
  );
}

export default function CalendarsScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const focused = useScreenFocus();
  const display = useDisplaySettings();
  const calendars = useDataStore((s) => s.calendars);
  const syncing = useSyncStore((s) => s.syncing);
  const online = useSyncStore((s) => s.online);
  const invites = useRemoteData(() => (online ? api.myInvitations() : Promise.resolve([])), [online], []);
  const [filter, setFilter] = useState<Filter>('all');
  const decor = Math.min(useDecorSize('header'), 132);

  const now = useNow();
  const [from, to] = useMemo(() => [new Date(now - 6 * 3600_000), new Date(now + 60 * 86_400_000)], [now]);
  const occurrences = useOccurrences(from, to);
  const nextByCalendar = useMemo(() => {
    const map: Record<string, Occurrence> = {};
    for (const occ of [...occurrences].sort((a, b) => a.start.getTime() - b.start.getTime())) {
      if (occ.end.getTime() <= now || occ.event.status === 'cancelled') continue;
      map[occ.event.calendar_id] ??= occ;
    }
    return map;
  }, [occurrences, now]);

  const groups = useMemo(() => {
    const live = calendars.filter((c) => !c.deleted_at && c.status === 'active');
    const shown =
      filter === 'shared'
        ? live.filter((c) => c.member_count > 1)
        : filter === 'mine'
          ? live.filter((c) => c.my_role === 'owner')
          : live;
    return {
      live,
      shown,
      archived: calendars.filter((c) => !c.deleted_at && c.status === 'archived'),
      trash: calendars.filter((c) => !!c.deleted_at),
    };
  }, [calendars, filter]);
  const pendingInvites = invites.data?.length ?? 0;

  const refresh = () => {
    void syncNow();
    void invites.refresh();
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.lg }]}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.column}>
          <Cascade>
            <OrbitRings
              size={decor}
              paused={!focused}
              style={[styles.decor, { right: decor * 0.2, top: -decor * 0.36 }]}
            />
            <View style={styles.header}>
              <AppText variant="title" style={[styles.flex, styles.title]} accessibilityRole="header">
                {t('calendars.title')}
              </AppText>
              <IconButton
                icon="search"
                label={t('common.search')}
                onPress={() => router.push('/search')}
                filled
              />
            </View>

            {calendars.length === 0 ? (
              <EmptyState
                art="orbit"
                title={t('calendars.emptyTitle')}
                message={t('calendars.emptyMessage')}
                actionLabel={t('calendars.inviteSomeone')}
                actionIcon="person-add-outline"
                onAction={() => router.push({ pathname: '/calendar/new', params: { kind: 'shared' } })}
                secondaryLabel={t('calendars.justForMe')}
                onSecondary={() => router.push({ pathname: '/calendar/new', params: { kind: 'personal' } })}
              />
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chips}
                >
                  <Chip
                    label={t('calendars.filterAll', { n: groups.live.length })}
                    selected={filter === 'all'}
                    onPress={() => setFilter('all')}
                  />
                  <Chip
                    label={t('calendars.filterShared')}
                    selected={filter === 'shared'}
                    onPress={() => setFilter('shared')}
                  />
                  <Chip
                    label={t('calendars.filterMine')}
                    selected={filter === 'mine'}
                    onPress={() => setFilter('mine')}
                  />
                </ScrollView>

                <View style={styles.actions}>
                  <Button
                    title={t('calendars.joinShort')}
                    icon="key-outline"
                    variant="tonal"
                    compact
                    onPress={() => router.push('/invites/accept')}
                  />
                  <Button
                    title={
                      pendingInvites
                        ? `${t('calendars.invitesShort')} (${pendingInvites})`
                        : t('calendars.invitesShort')
                    }
                    icon="mail-outline"
                    variant={pendingInvites ? 'primary' : 'secondary'}
                    compact
                    onPress={() => router.push('/invites')}
                  />
                </View>

                <View style={styles.list} key={filter}>
                  {groups.shown.map((c, i) => (
                    <EnterItem key={c.id} index={i}>
                      <CalendarCard calendar={c} next={nextByCalendar[c.id]} display={display} now={now} />
                    </EnterItem>
                  ))}
                </View>
                {groups.archived.length > 0 && (
                  <>
                    <SectionHeader title={t('calendars.archived')} />
                    <View style={styles.list}>
                      {groups.archived.map((c) => (
                        <CalendarCard key={c.id} calendar={c} display={display} />
                      ))}
                    </View>
                  </>
                )}
                {groups.trash.length > 0 && (
                  <>
                    <SectionHeader title={t('calendars.trash')} />
                    <View style={styles.list}>
                      {groups.trash.map((c) => (
                        <CalendarCard key={c.id} calendar={c} display={display} />
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
          </Cascade>
        </View>
      </ScrollView>
      <FAB icon="add" label={t('calendars.new')} onPress={() => router.push('/calendar/new')} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: SCREEN_MARGIN, paddingBottom: 120 },
  column: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', gap: spacing.lg },
  decor: { position: 'absolute' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 26, lineHeight: 32 },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.md },
  card: { gap: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontSize: 18, lineHeight: 22, ...fonte('tituloForte') },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  add: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
