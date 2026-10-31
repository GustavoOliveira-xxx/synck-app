// Uma agenda: cabeçalho na cor dela, atalhos para o que mais se faz (marcar,
// convidar, ver no calendário, achar horário), os próximos compromissos e,
// por último, as ferramentas e ajustes.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { AvatarStack } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { Icon, type IconName } from '@/components/Icon';
import { ListItem } from '@/components/ListItem';
import { EnterItem, PressableScale } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/StateViews';
import { SwitchRow } from '@/components/SwitchRow';
import { useAction } from '@/hooks/useAction';
import { useCalendar } from '@/hooks/useCalendar';
import { useCalendarMembers } from '@/hooks/useCalendarMembers';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useOccurrences } from '@/hooks/useEventsView';
import { useNow } from '@/hooks/useNow';
import { strings, t } from '@/i18n';
import type { Occurrence, TimeFormat } from '@/models/types';
import { syncNow } from '@/offline/syncEngine';
import { goBack } from '@/services/navigation';
import { saveTextFile } from '@/services/share';
import * as api from '@/services/api';
import { useUserId } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useUiStore } from '@/stores/uiStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, fonte, mix, pastel, radius, spacing } from '@/theme/tokens';
import { dateKeyParts, formatTime, toDateKey } from '@/utils/dates';
import { DEFAULT_FILTERS } from '@/utils/filters';
import { toIcs } from '@/utils/ics';
import { canCreateEvents, canEditCalendarSettings, canInvite, isOwner } from '@/utils/permissions';

/** Atalho redondo com ícone e rótulo (Novo evento, Convidar...). */
function QuickAction({
  icon,
  label,
  onPress,
  primary,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  primary?: boolean;
  testID?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <PressableScale
      onPress={onPress}
      haptic
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.quick}
      testID={testID}
    >
      <View
        style={[
          styles.quickIcon,
          { backgroundColor: primary ? colors.primary : colors.surface, borderColor: colors.border },
        ]}
      >
        <Icon name={icon} size={22} color={primary ? colors.primaryText : colors.primaryInk} />
      </View>
      <AppText variant="caption" center numberOfLines={2}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const UPCOMING_DAYS = 60;

/** Compromisso da agenda: selo com o dia à esquerda, título e horário. */
function UpcomingRow({
  occ,
  color,
  timezone,
  timeFormat,
  index,
}: {
  occ: Occurrence;
  color: string;
  timezone: string;
  timeFormat: TimeFormat;
  index: number;
}) {
  const { colors } = useAppTheme();
  const day = occ.allDay && occ.startDate ? occ.startDate : toDateKey(occ.start, timezone);
  const { day: d, month } = dateKeyParts(day);
  const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
  const title = occ.event.is_masked ? t('events.maskedTitle') : (occ.title ?? '');
  const when = occ.allDay ? t('calendarGrid.allDay') : formatTime(occ.start, timezone, timeFormat);
  return (
    <EnterItem index={index}>
      <Card
        onPress={() =>
          router.push({ pathname: '/event/[id]', params: { id: occ.event.id, date: occ.originalDate } })
        }
        accessibilityLabel={`${title}. ${strings.weekdays.long[wd]}, ${d} de ${strings.months.long[month - 1]}, ${when}`}
        style={styles.upcoming}
      >
        <View style={[styles.dayBadge, { backgroundColor: colors.primarySoft }]}>
          <AppText variant="overline" style={{ color: colors.primaryInk }}>
            {strings.weekdays.short[wd]}
          </AppText>
          <AppText style={[styles.dayNum, { color: colors.primaryInk }]}>{d}</AppText>
        </View>
        <View style={[styles.bar, { backgroundColor: color }]} />
        <View style={styles.flex}>
          <AppText variant="eventTitle" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {[`${when} · ${strings.months.short[month - 1]}`, occ.location].filter(Boolean).join(' · ')}
          </AppText>
        </View>
        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
    </EnterItem>
  );
}

export default function CalendarDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, dark } = useAppTheme();
  const calendar = useCalendar(id);
  const userId = useUserId();
  const display = useDisplaySettings();
  const members = useCalendarMembers(id);
  const { confirm, toast } = useFeedback();
  const { run, busy } = useAction();
  const now = useNow();
  // Próximos compromissos só desta agenda (60 dias).
  // Recalcula o período a cada hora, não a cada minuto.
  const hour = Math.floor(now / 3600_000);
  const [from, to] = useMemo(
    () => [new Date((hour - 1) * 3600_000), new Date((hour + UPCOMING_DAYS * 24) * 3600_000)],
    [hour],
  );
  const filters = useMemo(() => ({ ...DEFAULT_FILTERS, calendarIds: id ? [id] : [] }), [id]);
  const occurrences = useOccurrences(from, to, filters);
  const upcoming = useMemo(
    () =>
      occurrences
        .filter((o) => o.end.getTime() > now && o.event.status !== 'cancelled')
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .slice(0, 4),
    [occurrences, now],
  );

  if (!calendar) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('errors.notFound')} />
      </Screen>
    );
  }

  const owner = isOwner(calendar.my_role);
  const trashed = !!calendar.deleted_at;

  // Abre a aba Calendário mostrando só esta agenda (antes ia para a tela Hoje).
  const viewInCalendar = () => {
    useUiStore.getState().setFilters({ ...DEFAULT_FILTERS, calendarIds: [calendar.id] });
    router.navigate('/month');
  };
  const newEvent = () => router.push({ pathname: '/event/new', params: { calendarId: calendar.id } });
  const color = agendaColor(calendar.color, dark) ?? colors.primary;
  const base = agendaColor(calendar.color, false) ?? colors.primary;
  const heroBg = dark ? mix(base, colors.surface, 0.72) : pastel(base);
  const initial = calendar.name.trim().charAt(0).toUpperCase() || '?';
  const people = members.map((m) => ({ name: m.display_name, color: m.avatar_color }));
  const writable = canCreateEvents(calendar);
  const shared = calendar.kind !== 'personal';

  const setState = async (action: 'unarchive' | 'restore' | 'purge') => {
    if (action === 'purge') {
      const ok = await confirm({
        title: t('calendars.purge'),
        message: t('calendars.purgeMessage'),
        confirmLabel: t('calendars.purge'),
        destructive: true,
        typeToConfirm: 'EXCLUIR',
      });
      if (!ok) return;
    }
    const result = await run(() => api.setCalendarState(calendar.id, action), { success: t('common.saved') });
    if (!result.ok) return;
    if (action === 'purge') {
      useDataStore.getState().removeCalendar(calendar.id);
      goBack();
    }
    await syncNow();
  };

  const leave = async () => {
    if (owner) {
      await confirm({
        title: t('calendars.leave'),
        message: t('calendars.ownerCannotLeave'),
        cancelLabel: t('common.close'),
        choices: [],
      });
      return;
    }
    const ok = await confirm({
      title: t('calendars.leave'),
      message: t('calendars.leaveMessage'),
      destructive: true,
      confirmLabel: t('calendars.leave'),
    });
    if (!ok) return;
    const result = await run(() => api.leaveCalendar(calendar.id));
    if (result.ok) {
      useDataStore.getState().removeCalendar(calendar.id);
      await syncNow();
      goBack();
    }
  };

  const exportIcs = async () => {
    const events = Object.values(useDataStore.getState().events).filter((e) => e.calendar_id === calendar.id);
    const name = calendar.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'agenda';
    const result = await saveTextFile(`${name}.ics`, toIcs(events, calendar.name), 'text/calendar');
    if (result !== 'cancelled') toast(t('ics.exported'));
  };

  const toggleNotifications = (enabled: boolean) =>
    run(async () => {
      if (!userId) return;
      await api.setMyCalendarNotifications(calendar.id, userId, enabled);
      await syncNow();
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      <View style={[styles.hero, { backgroundColor: heroBg }]}>
        <View style={styles.headerRow}>
          <View style={[styles.swatch, { backgroundColor: color }]}>
            <AppText style={[styles.initial, { color: '#FFFFFF' }]}>{initial}</AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="title" accessibilityRole="header">
              {calendar.name}
            </AppText>
            <AppText variant="small" tone="muted">
              {`${strings.calendarKinds[calendar.kind]} · ${t('calendars.people', { n: calendar.member_count })}`}
            </AppText>
          </View>
        </View>
        {calendar.description ? <AppText>{calendar.description}</AppText> : null}
        <View style={styles.badges}>
          <Badge label={strings.roles[calendar.my_role]} tone="primary" icon="person-outline" />
          {calendar.status === 'archived' && (
            <Badge label={t('calendars.archivedBadge')} tone="warning" icon="archive-outline" />
          )}
          {trashed && <Badge label={t('calendars.trashBadge')} tone="danger" icon="trash-outline" />}
          <View style={styles.flex} />
          <AvatarStack people={people} max={4} size={30} />
        </View>
      </View>

      {trashed ? (
        owner && (
          <View style={styles.actions}>
            <Button
              title={t('calendars.restore')}
              icon="arrow-undo-outline"
              onPress={() => setState('restore')}
              loading={busy}
            />
            <Button
              title={t('calendars.purge')}
              icon="trash-outline"
              variant="danger"
              onPress={() => setState('purge')}
            />
          </View>
        )
      ) : (
        <>
          {calendar.status === 'archived' && (
            <Card>
              <AppText>{t('calendars.readOnly')}</AppText>
              {owner && (
                <Button
                  title={t('calendars.unarchive')}
                  variant="secondary"
                  onPress={() => setState('unarchive')}
                />
              )}
            </Card>
          )}

          <View style={styles.quickRow}>
            {writable && (
              <QuickAction
                icon="add"
                label={t('calendarView.newEvent')}
                onPress={newEvent}
                primary
                testID="calendar-new-event"
              />
            )}
            {canInvite(calendar) && (
              <QuickAction
                icon="person-add-outline"
                label={t('calendars.invite')}
                onPress={() =>
                  router.push({ pathname: '/calendar/[id]/invite', params: { id: calendar.id } })
                }
              />
            )}
            <QuickAction
              icon="calendar-outline"
              label={t('calendars.viewCalendar')}
              onPress={viewInCalendar}
            />
            {shared ? (
              <QuickAction
                icon="grid-outline"
                label={t('calendars.findTimeShort')}
                onPress={() =>
                  router.push({ pathname: '/calendar/[id]/find-time', params: { id: calendar.id } })
                }
              />
            ) : (
              <QuickAction
                icon="document-text-outline"
                label={t('calendars.notesShort')}
                onPress={() => router.push({ pathname: '/notes', params: { calendarId: calendar.id } })}
              />
            )}
          </View>

          <SectionHeader title={t('calendars.upcoming')} />
          {upcoming.length ? (
            <View style={styles.list}>
              {upcoming.map((occ, i) => (
                <UpcomingRow
                  key={occ.key}
                  occ={occ}
                  index={i}
                  color={agendaColor(occ.event.color ?? calendar.color, dark) ?? color}
                  timezone={display.timezone}
                  timeFormat={display.timeFormat}
                />
              ))}
            </View>
          ) : (
            <Card style={styles.emptyCard}>
              <AppText tone="muted" style={styles.flex}>
                {t('calendars.nothingNext')}
              </AppText>
              {writable && (
                <Button
                  title={t('calendarView.newEvent')}
                  icon="add"
                  compact
                  variant="tonal"
                  onPress={newEvent}
                />
              )}
            </Card>
          )}

          <SectionHeader title={t('calendars.together')} />
          <Card padded={false}>
            <ListItem
              icon="group-outline"
              title={t('calendars.membersTitle')}
              subtitle={t('calendars.members', { n: calendar.member_count })}
              onPress={() => router.push({ pathname: '/calendar/[id]/members', params: { id: calendar.id } })}
            />
            <ListItem
              icon="document-text-outline"
              title={t('calendars.notes')}
              onPress={() => router.push({ pathname: '/notes', params: { calendarId: calendar.id } })}
            />
            {shared && (
              <ListItem
                icon="poll-outline"
                title={t('calendars.polls')}
                onPress={() => router.push({ pathname: '/calendar/[id]/polls', params: { id: calendar.id } })}
              />
            )}
            <ListItem
              icon="time-outline"
              title={t('calendars.history')}
              onPress={() => router.push({ pathname: '/calendar/[id]/history', params: { id: calendar.id } })}
            />
          </Card>

          <SectionHeader title={t('calendars.tools')} />
          <Card padded={false}>
            <ListItem
              icon="export-outline"
              title={t('ics.export')}
              subtitle={t('ics.exportHint')}
              onPress={() => void exportIcs()}
            />
            {writable && (
              <ListItem
                icon="import-outline"
                title={t('ics.import')}
                onPress={() =>
                  router.push({ pathname: '/calendar/[id]/import', params: { id: calendar.id } })
                }
              />
            )}
            {canEditCalendarSettings(calendar.my_role) && (
              <ListItem
                icon="settings-outline"
                title={t('calendars.settings')}
                onPress={() =>
                  router.push({ pathname: '/calendar/[id]/settings', params: { id: calendar.id } })
                }
              />
            )}
          </Card>
          <Card>
            <SwitchRow
              label={t('calendars.notificationsForMe')}
              value={calendar.my_notifications_enabled}
              onChange={toggleNotifications}
            />
          </Card>
          <AppText variant="small" tone="muted">
            {strings.roleDescriptions[calendar.my_role]}
          </AppText>
          {!owner && (
            <Button title={t('calendars.leave')} icon="exit-outline" variant="secondary" onPress={leave} />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  swatch: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 24, lineHeight: 30, ...fonte('tituloForte') },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quick: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: spacing.sm },
  upcoming: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  dayBadge: { width: 48, borderRadius: radius.md, alignItems: 'center', paddingVertical: spacing.xs },
  dayNum: { fontSize: 20, lineHeight: 24, ...fonte('tituloForte') },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  actions: { gap: spacing.sm },
});
