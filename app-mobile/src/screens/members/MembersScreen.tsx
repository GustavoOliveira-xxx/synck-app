import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { ListItem } from '@/components/ListItem';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useCalendar } from '@/hooks/useCalendar';
import { useRemoteData } from '@/hooks/useRemoteData';
import { strings, t } from '@/i18n';
import { persistData } from '@/offline/syncEngine';
import * as api from '@/services/api';
import { useUserId } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { canInvite, canManageMember } from '@/utils/permissions';
import { CONTENT_MAX_WIDTH } from '@/utils/layout';

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const calendar = useCalendar(id);
  const userId = useUserId();
  const cached = useDataStore((s) => s.members[id]);
  const { data, loading, refreshing, error, refresh, reload } = useRemoteData(
    () => api.listMembers(id),
    [id],
    cached,
  );

  // Guarda a lista no aparelho para consulta offline.
  useEffect(() => {
    if (data && userId) {
      useDataStore.getState().set({ members: { ...useDataStore.getState().members, [id]: data } });
      void persistData(userId);
    }
  }, [data, id, userId]);

  const members = data ?? [];
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t('members.title') }} />
      <OfflineBanner />
      {loading && !members.length ? (
        <LoadingState />
      ) : error && !members.length ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.member_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            calendar && canInvite(calendar) ? (
              <Button
                title={t('calendars.invite')}
                icon="person-add-outline"
                onPress={() => router.push({ pathname: '/calendar/[id]/invite', params: { id } })}
              />
            ) : undefined
          }
          renderItem={({ item }) => {
            const manageable = !!calendar && canManageMember(calendar.my_role, item.role, item.is_me);
            return (
              <ListItem
                title={item.is_me ? `${item.display_name} ${t('members.me')}` : item.display_name}
                subtitle={strings.roleDescriptions[item.role]}
                left={<Avatar name={item.display_name} color={item.avatar_color} />}
                right={
                  <Badge
                    label={strings.roles[item.role]}
                    tone={item.role === 'owner' ? 'primary' : 'neutral'}
                  />
                }
                chevron={manageable || (calendar?.my_role === 'owner' && !item.is_me)}
                onPress={
                  manageable || (calendar?.my_role === 'owner' && !item.is_me)
                    ? () =>
                        router.push({
                          pathname: '/calendar/[id]/member/[memberId]',
                          params: { id, memberId: item.member_id },
                        })
                    : undefined
                }
              />
            );
          }}
          ListFooterComponent={
            <AppText variant="small" tone="muted" style={styles.footer}>
              {t('calendars.members', { n: members.length })}
            </AppText>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Coluna centralizada em telas largas, como as demais telas.
  list: {
    padding: spacing.lg,
    gap: spacing.xs,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  footer: { marginTop: spacing.md, textAlign: 'center' },
});
