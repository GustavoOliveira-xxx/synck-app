import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { SelectField } from '@/components/SelectField';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useAction } from '@/hooks/useAction';
import { useCalendar } from '@/hooks/useCalendar';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { useRemoteData } from '@/hooks/useRemoteData';
import { strings, t } from '@/i18n';
import type { CreatedInvitation, InvitationSummary, Role } from '@/models/types';
import * as api from '@/services/api';
import { shareMessage } from '@/services/share';
import { useAppTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { formatDateTime } from '@/utils/dates';
import { grantableRoles } from '@/utils/permissions';
import { validateEmail } from '@/validation/auth';

const STATUS_TONE: Record<
  InvitationSummary['status'],
  'primary' | 'success' | 'danger' | 'neutral' | 'warning'
> = {
  pending: 'primary',
  accepted: 'success',
  declined: 'danger',
  cancelled: 'neutral',
  expired: 'warning',
  exhausted: 'neutral',
};

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const calendar = useCalendar(id);
  const { colors } = useAppTheme();
  const display = useDisplaySettings();
  const { toast, confirm } = useFeedback();
  const { run, busy } = useAction();
  const roles = calendar ? grantableRoles(calendar.my_role) : [];
  const [role, setRole] = useState<Exclude<Role, 'owner'>>(
    calendar && roles.includes(calendar.default_member_role)
      ? calendar.default_member_role
      : (roles[roles.length - 1] ?? 'viewer'),
  );
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [expires, setExpires] = useState<number | null>(168);
  const [maxUses, setMaxUses] = useState<number | null>(1);
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const list = useRemoteData(() => api.listInvitations(id), [id], []);

  if (!calendar) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('errors.notFound')} />
      </Screen>
    );
  }

  const create = async () => {
    const trimmed = email.trim();
    const e = trimmed ? validateEmail(trimmed) : undefined;
    setEmailError(e);
    if (e) return;
    const result = await run(() =>
      api.createInvitation({
        calendarId: id,
        role,
        email: trimmed || null,
        expiresInHours: expires,
        maxUses: trimmed ? 1 : maxUses,
      }),
    );
    if (result.ok) {
      setCreated(result.value);
      setEmail('');
      void list.refresh();
    }
  };

  const shareText = created ? t('invites.shareMessage', { calendar: calendar.name, code: created.code }) : '';

  const cancel = async (inv: InvitationSummary) => {
    const ok = await confirm({
      title: t('invites.cancelInvite'),
      destructive: true,
      confirmLabel: t('invites.cancelInvite'),
    });
    if (!ok) return;
    const result = await run(() => api.cancelInvitation(inv.id), { success: t('invites.cancelled') });
    if (result.ok) void list.refresh();
  };

  return (
    <Screen refreshing={list.refreshing} onRefresh={list.refresh}>
      <Stack.Screen options={{ title: t('invites.title') }} />

      {created && (
        <Card style={{ borderColor: colors.primary, borderWidth: 2 }}>
          <AppText variant="heading">{t('invites.createdTitle')}</AppText>
          <View style={[styles.codeBox, { backgroundColor: colors.primarySoft }]}>
            <AppText
              variant="display"
              center
              selectable
              accessibilityLabel={created.code.split('').join(' ')}
            >
              {created.code}
            </AppText>
          </View>
          <AppText variant="small" tone="muted">
            {t('invites.createdMessage')}
          </AppText>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                title={t('common.copy')}
                icon="copy-outline"
                variant="secondary"
                onPress={async () => {
                  await Clipboard.setStringAsync(created.code);
                  toast(t('common.copied'));
                }}
              />
            </View>
            <View style={styles.flex}>
              <Button
                title={t('common.share')}
                icon="share-social-outline"
                onPress={async () => {
                  if ((await shareMessage(shareText)) === 'copied') toast(t('common.copiedToShare'));
                }}
              />
            </View>
          </View>
        </Card>
      )}

      <SelectField<Exclude<Role, 'owner'>>
        label={t('invites.role')}
        value={role}
        onChange={setRole}
        options={roles.map((r) => ({
          value: r,
          label: strings.roles[r],
          description: strings.roleDescriptions[r],
        }))}
      />
      <TextField
        label={t('invites.byEmail')}
        value={email}
        onChangeText={setEmail}
        error={emailError}
        hint={t('invites.emailHint')}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <SelectField<number | null>
        label={t('invites.expires')}
        value={expires}
        onChange={setExpires}
        options={[
          { value: 24, label: t('invites.expires1d') },
          { value: 168, label: t('invites.expires7d') },
          { value: 720, label: t('invites.expires30d') },
          { value: null, label: t('invites.expiresNever') },
        ]}
      />
      {!email.trim() && (
        <SelectField<number | null>
          label={t('invites.maxUses')}
          value={maxUses}
          onChange={setMaxUses}
          options={[
            { value: 1, label: t('invites.uses1') },
            { value: 5, label: t('invites.uses5') },
            { value: null, label: t('invites.usesUnlimited') },
          ]}
        />
      )}
      <Button title={t('invites.create')} icon="key-outline" onPress={create} loading={busy} />

      <SectionHeader title={t('invites.list')} />
      {list.loading && !list.data?.length ? (
        <LoadingState kind="rows" />
      ) : list.data?.length ? (
        list.data.map((inv) => (
          <Card key={inv.id}>
            <View style={styles.row}>
              <AppText style={styles.flex}>
                {inv.invited_email ?? t('invites.hint', { hint: inv.code_hint })}
              </AppText>
              <Badge label={strings.invites.status[inv.status]} tone={STATUS_TONE[inv.status]} />
            </View>
            <AppText variant="small" tone="muted">
              {strings.roles[inv.role]} ·{' '}
              {inv.max_uses
                ? t('invites.usesCount', { used: inv.use_count, max: inv.max_uses })
                : t('invites.usesCountUnlimited', { used: inv.use_count })}{' '}
              ·{' '}
              {inv.expires_at
                ? t('invites.expiresAt', {
                    date: formatDateTime(
                      new Date(inv.expires_at),
                      display.timezone,
                      display.dateFormat,
                      display.timeFormat,
                    ),
                  })
                : t('invites.noExpiration')}
            </AppText>
            {inv.status === 'pending' && (
              <Button title={t('invites.cancelInvite')} variant="ghost" compact onPress={() => cancel(inv)} />
            )}
          </Card>
        ))
      ) : (
        <AppText tone="muted">{t('invites.noInvites')}</AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeBox: { borderRadius: radius.md, paddingVertical: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
