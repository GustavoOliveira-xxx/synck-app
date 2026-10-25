import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAction } from '@/hooks/useAction';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { strings, t } from '@/i18n';
import type { InvitationPreview } from '@/models/types';
import { syncNow } from '@/offline/syncEngine';
import * as api from '@/services/api';
import { goBack } from '@/services/navigation';
import { radius, spacing } from '@/theme/tokens';
import { formatDateTime } from '@/utils/dates';
import { toFriendlyError } from '@/utils/errors';
import { formatInviteCode, validateInviteCode } from '@/validation/invite';

/** Digitar o código, ver a prévia (qual agenda e qual papel) e só então aceitar. */
export default function AcceptInviteScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const display = useDisplaySettings();
  const { run, busy } = useAction();
  const [code, setCode] = useState(params.code ? formatInviteCode(params.code) : '');
  const [error, setError] = useState<string | undefined>();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);

  const check = async () => {
    const e = validateInviteCode(code);
    setError(e);
    setPreview(null);
    if (e) return;
    const result = await run(() => api.previewInvitation(code));
    if (!result.ok) return;
    if (!result.value.ok) setError(toFriendlyError({ message: result.value.error }).message);
    else setPreview(result.value);
  };

  const accept = async () => {
    const result = await run(() => api.acceptInvitation(code));
    if (!result.ok) return;
    if (!result.value.ok) {
      setError(toFriendlyError({ message: result.value.error }).message);
      return;
    }
    await syncNow();
    router.replace({
      pathname: '/invites/accepted',
      params: {
        calendarId: result.value.calendar_id ?? '',
        name: preview?.calendar_name ?? '',
        role: preview?.role ?? '',
      },
    });
  };

  const blocked = preview && preview.status !== 'pending';

  return (
    <Screen>
      <Stack.Screen options={{ title: t('invites.enterCode') }} />
      <TextField
        label={t('auth.code')}
        placeholder={t('invites.codePlaceholder')}
        value={code}
        onChangeText={(v) => {
          setCode(formatInviteCode(v));
          setPreview(null);
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        error={error}
        maxLength={14}
        testID="invite-code"
      />
      {!preview && <Button title={t('invites.check')} onPress={check} loading={busy} testID="invite-check" />}

      {preview && (
        <Card>
          <AppText variant="heading">{t('invites.previewTitle')}</AppText>
          <View style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: preview.calendar_color }]} />
            <View style={styles.flex}>
              <AppText variant="label" tone="muted">
                {t('invites.previewCalendar')}
              </AppText>
              <AppText variant="title">{preview.calendar_name}</AppText>
            </View>
          </View>
          <AppText variant="label" tone="muted">
            {t('invites.previewRole')}
          </AppText>
          <AppText variant="heading">{preview.role ? strings.roles[preview.role] : ''}</AppText>
          <AppText variant="small" tone="muted">
            {preview.role ? strings.roleDescriptions[preview.role] : ''}
          </AppText>
          <AppText>
            {t('invites.previewInviter')}: {preview.inviter_name}
          </AppText>
          {preview.expires_at ? (
            <AppText variant="small" tone="muted">
              {t('invites.previewExpires')}:{' '}
              {formatDateTime(
                new Date(preview.expires_at),
                display.timezone,
                display.dateFormat,
                display.timeFormat,
              )}
            </AppText>
          ) : null}
          {preview.already_member ? <AppText tone="success">{t('invites.alreadyMember')}</AppText> : null}
          {blocked ? (
            <AppText tone="danger">{strings.invites.status[preview.status!]}</AppText>
          ) : (
            <Button title={t('invites.accept')} onPress={accept} loading={busy} testID="invite-accept" />
          )}
          <Button title={t('invites.notNow')} variant="ghost" onPress={() => goBack()} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  swatch: { width: 40, height: 40, borderRadius: radius.lg },
  flex: { flex: 1 },
});
