import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useRemoteData } from '@/hooks/useRemoteData';
import { t } from '@/i18n';
import type { ActivityEntry } from '@/models/types';
import * as api from '@/services/api';
import { useUserId } from '@/stores/authStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { describeActivity } from '@/utils/activity';
import { formatDateTime } from '@/utils/dates';
import { CONTENT_MAX_WIDTH } from '@/utils/layout';

/** Histórico de atividades da agenda ou de um evento (respeita permissões no servidor). */
export function ActivityList({ calendarId, eventId }: { calendarId: string; eventId?: string }) {
  const { colors } = useAppTheme();
  const display = useDisplaySettings();
  const userId = useUserId();
  const [extra, setExtra] = useState<ActivityEntry[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const { data, loading, refreshing, error, refresh, reload } = useRemoteData(
    () => api.listActivity(calendarId, { eventId }),
    [calendarId, eventId],
  );
  const items = [...(data ?? []), ...extra];

  const loadMore = async () => {
    const last = items[items.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const more = await api.listActivity(calendarId, { eventId, beforeId: last.id });
      setExtra((e) => [...e, ...more]);
      if (more.length < 50) setDone(true);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !items.length) return <ErrorState message={error.message} onRetry={reload} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListEmptyComponent={<EmptyState icon="time-outline" title={t('activity.empty')} />}
      renderItem={({ item }) => (
        <Card>
          <AppText>{describeActivity(item, userId)}</AppText>
          <AppText variant="small" tone="muted">
            {formatDateTime(
              new Date(item.created_at),
              display.timezone,
              display.dateFormat,
              display.timeFormat,
            )}
          </AppText>
        </Card>
      )}
      ListFooterComponent={
        items.length >= 50 && !done ? (
          <View style={{ marginTop: spacing.md }}>
            <Button
              title={t('activity.loadMore')}
              variant="secondary"
              onPress={loadMore}
              loading={loadingMore}
            />
          </View>
        ) : undefined
      }
      style={{ backgroundColor: colors.background }}
    />
  );
}

export default function HistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t('activity.title') }} />
      <OfflineBanner />
      <ActivityList calendarId={id} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Coluna centralizada em telas largas, como as demais telas.
  list: {
    padding: spacing.lg,
    gap: spacing.sm,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
});
