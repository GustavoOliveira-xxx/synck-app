import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { ListItem } from '@/components/ListItem';
import { Screen } from '@/components/Screen';
import { LoadingState } from '@/components/StateViews';
import { useAction } from '@/hooks/useAction';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useRemoteData } from '@/hooks/useRemoteData';
import { t } from '@/i18n';
import { getInstallationId } from '@/offline/storage';
import * as api from '@/services/api';
import { signOutOtherDevices } from '@/services/auth';
import { formatDateTime } from '@/utils/dates';

export default function DevicesScreen() {
  const display = useDisplaySettings();
  const { confirm } = useFeedback();
  const { run, busy } = useAction();
  const [mine, setMine] = useState<string | null>(null);
  const devices = useRemoteData(() => api.listDevices(), []);

  useEffect(() => {
    void getInstallationId().then(setMine);
  }, []);

  const signOutOthers = async () => {
    const ok = await confirm({
      title: t('devices.signOutOthers'),
      message: t('devices.signOutOthersMessage'),
      destructive: true,
    });
    if (!ok) return;
    const result = await run(
      async () => {
        await signOutOtherDevices();
        const list = devices.data ?? [];
        await Promise.all(list.filter((d) => d.installation_id !== mine).map((d) => api.removeDevice(d.id)));
      },
      { success: t('devices.signedOutOthers') },
    );
    if (result.ok) void devices.refresh();
  };

  return (
    <Screen refreshing={devices.refreshing} onRefresh={devices.refresh}>
      <Stack.Screen options={{ title: t('devices.title') }} />
      {devices.loading ? (
        <LoadingState kind="rows" />
      ) : devices.error ? (
        <AppText tone="danger">{devices.error.message}</AppText>
      ) : (
        <Card padded={false}>
          {(devices.data ?? []).map((d) => (
            <ListItem
              key={d.id}
              icon={d.platform === 'web' ? 'desktop-outline' : 'phone-portrait-outline'}
              title={`${d.device_name ?? d.platform}${d.installation_id === mine ? ` (${t('devices.thisDevice')})` : ''}`}
              subtitle={[
                [d.platform, d.os_version].filter(Boolean).join(' '),
                d.app_version ? `app ${d.app_version}` : null,
                t('devices.lastSeen', {
                  date: formatDateTime(
                    new Date(d.last_seen_at),
                    display.timezone,
                    display.dateFormat,
                    display.timeFormat,
                  ),
                }),
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ))}
        </Card>
      )}
      <Button
        title={t('devices.signOutOthers')}
        icon="log-out-outline"
        variant="danger"
        onPress={signOutOthers}
        loading={busy}
      />
    </Screen>
  );
}
