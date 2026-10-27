import { router, useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { PressableScale, EnterItem } from '@/components/motion';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState } from '@/components/StateViews';
import { useAction } from '@/hooks/useAction';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useNow } from '@/hooks/useNow';
import { t } from '@/i18n';
import type { AppNotification, NotificationType } from '@/models/types';
import { syncNow } from '@/offline/syncEngine';
import * as api from '@/services/api';
import { useDataStore } from '@/stores/dataStore';
import { useSyncStore } from '@/stores/syncStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { CALENDAR_COLORS, fonte, pastel, radius, SCREEN_MARGIN, spacing } from '@/theme/tokens';
import { formatDateTime, formatRelative } from '@/utils/dates';
import { CONTENT_MAX_WIDTH } from '@/utils/layout';

/** Cor do ícone de cada tipo de aviso (eventos, pessoas, convites, remoções). */
const TINTS: Record<NotificationType, number> = {
  invite_received: 3,
  invite_accepted: 3,
  invite_declined: 1,
  event_created: 0,
  event_updated: 0,
  event_cancelled: 1,
  event_deleted: 1,
  member_added: 4,
  member_removed: 1,
  role_changed: 4,
  ownership_received: 2,
  comment_added: 0,
  task_assigned: 4,
  task_completed: 6,
  task_comment: 0,
  poll_created: 3,
  poll_closed: 6,
};

const ICONS: Record<NotificationType, IconName> = {
  invite_received: 'mail-outline',
  invite_accepted: 'person-add-outline',
  invite_declined: 'person-remove-outline',
  event_created: 'add-circle-outline',
  event_updated: 'create-outline',
  event_cancelled: 'close-circle-outline',
  event_deleted: 'trash-outline',
  member_added: 'people-outline',
  member_removed: 'exit-outline',
  role_changed: 'shield-outline',
  ownership_received: 'key-outline',
  comment_added: 'chatbubble-outline',
  task_assigned: 'task-outline',
  task_completed: 'checkmark-circle-outline',
  task_comment: 'chatbubble-outline',
  poll_created: 'poll-outline',
  poll_closed: 'poll-outline',
};

/** Central de avisos: convites, eventos, tarefas, enquetes, membros e comentários. */
export default function NotificationsScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const display = useDisplaySettings();
  const notifications = useDataStore((s) => s.notifications);
  const syncing = useSyncStore((s) => s.syncing);
  const { run } = useAction();
  const unread = notifications.filter((n) => !n.read_at).length;
  const now = useNow();

  const markAll = async () => {
    const result = await run(() => api.markNotificationsRead());
    if (result.ok) {
      const now = new Date().toISOString();
      useDataStore
        .getState()
        .set({ notifications: notifications.map((n) => ({ ...n, read_at: n.read_at ?? now })) });
    }
  };

  const clearRead = async () => {
    const result = await run(() => api.deleteReadNotifications());
    if (result.ok) useDataStore.getState().set({ notifications: notifications.filter((n) => !n.read_at) });
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        unread ? (
          <Button title={t('notificationsInbox.markAllRead')} variant="ghost" compact onPress={markAll} />
        ) : null,
    });
  });

  const open = (n: AppNotification) => {
    if (!n.read_at) {
      void api.markNotificationsRead([n.id]).catch(() => undefined);
      useDataStore.getState().set({
        notifications: notifications.map((x) =>
          x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x,
        ),
      });
    }
    const taskId = typeof n.data?.task_id === 'string' ? n.data.task_id : null;
    if (n.type === 'invite_received') router.push('/invites');
    else if (taskId) router.push({ pathname: '/task/[id]', params: { id: taskId } });
    else if (n.type === 'poll_created' && n.calendar_id)
      router.push({ pathname: '/calendar/[id]/polls', params: { id: n.calendar_id } });
    else if (n.event_id && n.type !== 'event_deleted')
      router.push({ pathname: '/event/[id]', params: { id: n.event_id } });
    else if (n.calendar_id && n.type !== 'member_removed')
      router.push({ pathname: '/calendar/[id]', params: { id: n.calendar_id } });
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => void syncNow()} />}
        contentContainerStyle={notifications.length ? styles.list : styles.flex}
        ListEmptyComponent={
          <EmptyState
            art="orbit"
            title={t('notificationsInbox.empty')}
            message={t('notificationsInbox.emptyMessage')}
          />
        }
        ListFooterComponent={
          notifications.some((n) => n.read_at) ? (
            <Button title={t('notificationsInbox.deleteAll')} variant="ghost" onPress={clearRead} />
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const tint = CALENDAR_COLORS[TINTS[item.type] ?? 0].value;
          const when = new Date(item.created_at);
          return (
            <EnterItem index={index}>
              <PressableScale
                scaleTo={0.99}
                onPress={() => open(item)}
                accessibilityRole="button"
                accessibilityLabel={[
                  item.read_at ? null : t('notificationsInbox.unread'),
                  item.title,
                  item.body,
                  formatDateTime(when, display.timezone, display.dateFormat, display.timeFormat),
                ]
                  .filter(Boolean)
                  .join('. ')}
                style={[
                  styles.item,
                  {
                    borderBottomColor: colors.border,
                    backgroundColor: 'transparent',
                  },
                ]}
              >
                <View style={[styles.tile, { backgroundColor: pastel(tint) }]}>
                  <Icon name={ICONS[item.type] ?? 'notifications-outline'} size={22} color={colors.onCoral} />
                </View>
                <View style={styles.texts}>
                  <AppText style={[styles.itemTitle, !item.read_at && fonte('negrito')]}>
                    {item.title}
                    {!item.read_at ? <AppText style={{ color: colors.coral }}> ●</AppText> : null}
                  </AppText>
                  {item.body ? (
                    <AppText variant="caption" tone="muted" numberOfLines={2}>
                      {item.body}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="caption" tone="muted">
                  {formatRelative(when, now, display.timezone, display.dateFormat)}
                </AppText>
              </PressableScale>
            </EnterItem>
          );
        }}
      />
      {notifications.length === 0 ? null : (
        <AppText variant="small" tone="muted" style={styles.note}>
          {t('notificationSettings.remoteNote')}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {
    paddingHorizontal: SCREEN_MARGIN,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 15, lineHeight: 20, ...fonte('semi') },
  note: { padding: spacing.lg, textAlign: 'center' },
});
