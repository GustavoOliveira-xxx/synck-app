import { Stack } from 'expo-router';
import { router } from '@/services/router';

import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { LoadingState } from '@/components/StateViews';
import { useAction } from '@/hooks/useAction';
import { useRemoteData } from '@/hooks/useRemoteData';
import { strings, t } from '@/i18n';
import { syncNow } from '@/offline/syncEngine';
import * as api from '@/services/api';
import { useSyncStore } from '@/stores/syncStore';
import { toFriendlyError } from '@/utils/errors';

/** Convites enviados para o e-mail da pessoa + atalho para digitar um código. */
export default function ReceivedInvitesScreen() {
  const online = useSyncStore((s) => s.online);
  const { run, busy } = useAction();
  const { toast } = useFeedback();
  const invites = useRemoteData(() => (online ? api.myInvitations() : Promise.resolve([])), [online], []);

  const respond = async (id: string, accept: boolean, calendarName: string, role: string) => {
    const result = await run(() => api.respondInvitation(id, accept));
    if (!result.ok) return;
    if (!result.value.ok) {
      toast(toFriendlyError({ message: result.value.error }).message, 'error');
      return;
    }
    await syncNow();
    if (accept) {
      router.replace({
        pathname: '/invites/accepted',
        params: { calendarId: result.value.calendar_id ?? '', name: calendarName, role },
      });
    } else {
      void invites.refresh();
    }
  };

  return (
    <Screen refreshing={invites.refreshing} onRefresh={invites.refresh}>
      <Stack.Screen options={{ title: t('invites.receivedTitle') }} />
      <Button
        title={t('invites.enterCode')}
        icon="key-outline"
        onPress={() => router.push('/invites/accept')}
      />
      {invites.loading ? (
        <LoadingState />
      ) : invites.error ? (
        <AppText tone="danger">{invites.error.message}</AppText>
      ) : invites.data?.length ? (
        invites.data.map((inv) => (
          <Card key={inv.id}>
            <AppText variant="heading">{inv.calendar_name}</AppText>
            <AppText tone="muted">
              {t('invites.previewInviter')}: {inv.inviter_name}
            </AppText>
            <Badge label={`${t('invites.previewRole')}: ${strings.roles[inv.role]}`} tone="primary" />
            <Button
              title={t('invites.accept')}
              onPress={() => respond(inv.id, true, inv.calendar_name, inv.role)}
              loading={busy}
            />
            <Button
              title={t('invites.decline')}
              variant="ghost"
              onPress={() => respond(inv.id, false, inv.calendar_name, inv.role)}
            />
          </Card>
        ))
      ) : (
        <AppText tone="muted">{online ? t('invites.noneReceived') : t('common.requiresInternet')}</AppText>
      )}
    </Screen>
  );
}
