import { Stack } from 'expo-router';
import { router } from '@/services/router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import * as api from '@/services/api';
import { saveJsonFile } from '@/services/share';

/** LGPD: exportar os próprios dados e excluir a conta. */
export default function PrivacyDataScreen() {
  const { run, busy } = useAction();
  const { toast } = useFeedback();

  const exportData = async () => {
    const result = await run(() => api.exportMyData(), { success: t('account.exportDone') });
    if (result.ok) {
      const saved = await saveJsonFile('meus-dados-agenda.json', result.value);
      if (saved === 'copied') toast(t('common.copiedToShare'));
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('account.privacyTitle') }} />
      <Card>
        <AppText variant="heading">{t('account.exportTitle')}</AppText>
        <AppText tone="muted">{t('account.exportMessage')}</AppText>
        <Button
          title={t('account.exportAction')}
          icon="download-outline"
          variant="secondary"
          onPress={exportData}
          loading={busy}
        />
      </Card>
      <Card>
        <AppText variant="heading">{t('account.deleteTitle')}</AppText>
        <Button
          title={t('account.deleteTitle')}
          icon="trash-outline"
          variant="danger"
          onPress={() => router.push('/settings/delete-account')}
        />
      </Card>
      <Button title={t('profile.privacyPolicy')} variant="ghost" onPress={() => router.push('/privacy')} />
    </Screen>
  );
}
