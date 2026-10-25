import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { ListItem } from '@/components/ListItem';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import { SwitchRow } from '@/components/SwitchRow';
import { useAction } from '@/hooks/useAction';
import { useCalendar } from '@/hooks/useCalendar';
import { strings, t } from '@/i18n';
import { syncNow } from '@/offline/syncEngine';
import { goBack } from '@/services/navigation';
import { saveTextFile } from '@/services/share';
import * as api from '@/services/api';
import { useUserId } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useUiStore } from '@/stores/uiStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { agendaColor, radius, spacing } from '@/theme/tokens';
import { DEFAULT_FILTERS } from '@/utils/filters';
import { toIcs } from '@/utils/ics';
import { canCreateEvents, canEditCalendarSettings, canInvite, isOwner } from '@/utils/permissions';

export default function CalendarDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dark } = useAppTheme();
  const calendar = useCalendar(id);
  const userId = useUserId();
  const { confirm, toast } = useFeedback();
  const { run, busy } = useAction();

  if (!calendar) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('errors.notFound')} />
      </Screen>
    );
  }

  const owner = isOwner(calendar.my_role);
  const trashed = !!calendar.deleted_at;

  const viewInCalendar = () => {
    useUiStore.getState().setFilters({ ...DEFAULT_FILTERS, calendarIds: [calendar.id] });
    router.navigate('/');
  };

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
      <Stack.Screen options={{ title: calendar.name }} />
      <Card>
        <View style={styles.headerRow}>
          <View style={[styles.swatch, { backgroundColor: agendaColor(calendar.color, dark) }]} />
          <View style={styles.flex}>
            <AppText variant="title">{calendar.name}</AppText>
            <AppText tone="muted">{strings.calendarKinds[calendar.kind]}</AppText>
          </View>
        </View>
        {calendar.description ? <AppText>{calendar.description}</AppText> : null}
        <View style={styles.badges}>
          <Badge label={strings.roles[calendar.my_role]} tone="primary" icon="person-outline" />
          <Badge label={t('calendars.members', { n: calendar.member_count })} icon="people-outline" />
          {calendar.status === 'archived' && (
            <Badge label={t('calendars.archivedBadge')} tone="warning" icon="archive-outline" />
          )}
          {trashed && <Badge label={t('calendars.trashBadge')} tone="danger" icon="trash-outline" />}
        </View>
        <AppText variant="small" tone="muted">
          {strings.roleDescriptions[calendar.my_role]}
        </AppText>
      </Card>

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
          <Card padded={false}>
            <ListItem icon="calendar-outline" title={t('calendars.viewCalendar')} onPress={viewInCalendar} />
            <ListItem
              icon="people-outline"
              title={t('calendars.membersTitle')}
              subtitle={t('calendars.members', { n: calendar.member_count })}
              onPress={() => router.push({ pathname: '/calendar/[id]/members', params: { id: calendar.id } })}
            />
            {canInvite(calendar) && (
              <ListItem
                icon="person-add-outline"
                title={t('calendars.invite')}
                onPress={() =>
                  router.push({ pathname: '/calendar/[id]/invite', params: { id: calendar.id } })
                }
              />
            )}
            <ListItem
              icon="time-outline"
              title={t('calendars.history')}
              onPress={() => router.push({ pathname: '/calendar/[id]/history', params: { id: calendar.id } })}
            />
            <ListItem
              icon="leaf-outline"
              title={t('calendars.notes')}
              onPress={() => router.push({ pathname: '/notes', params: { calendarId: calendar.id } })}
            />
            {calendar.kind !== 'personal' && (
              <>
                <ListItem
                  icon="grid-outline"
                  title={t('calendars.findTime')}
                  onPress={() =>
                    router.push({ pathname: '/calendar/[id]/find-time', params: { id: calendar.id } })
                  }
                />
                <ListItem
                  icon="poll-outline"
                  title={t('calendars.polls')}
                  onPress={() =>
                    router.push({ pathname: '/calendar/[id]/polls', params: { id: calendar.id } })
                  }
                />
              </>
            )}
            <ListItem
              icon="export-outline"
              title={t('ics.export')}
              subtitle={t('ics.exportHint')}
              onPress={() => void exportIcs()}
            />
            {canCreateEvents(calendar) && (
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
          {!owner && (
            <Button title={t('calendars.leave')} icon="exit-outline" variant="secondary" onPress={leave} />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  swatch: { width: 40, height: 40, borderRadius: radius.lg },
  flex: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { gap: spacing.sm },
});
