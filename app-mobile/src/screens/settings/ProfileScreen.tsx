import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Logo } from '@/components/brand/Logo';
import { Card } from '@/components/Card';
import { useFeedback } from '@/components/Feedback';
import { ListItem } from '@/components/ListItem';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { env } from '@/config/env';
import { useAvailableUpdate } from '@/hooks/useAvailableUpdate';
import { t } from '@/i18n';
import { endSession } from '@/services/session';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { marca } from '@/theme/marca';
import { spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  const account = useAuthStore((s) => s.account);
  const email = useAuthStore((s) => s.session?.user.email ?? '');
  const pending = useSyncStore((s) => s.outbox.length);
  const { confirm } = useFeedback();
  const update = useAvailableUpdate();
  const { colors } = useAppTheme();

  const logout = async () => {
    const ok = await confirm({
      title: t('auth.logoutConfirmTitle'),
      message: pending ? t('auth.logoutPendingMessage', { n: pending }) : t('auth.logoutConfirmMessage'),
      confirmLabel: pending ? t('auth.logoutAnyway') : t('auth.logout'),
      destructive: true,
    });
    if (ok) await endSession();
  };

  const name = account?.display_name ?? email;
  return (
    <Screen safeTop>
      <AppText variant="title" style={styles.title} accessibilityRole="header">
        {t('profile.title')}
      </AppText>
      <Card>
        <View style={styles.row}>
          <Avatar name={name} color={account?.avatar_color ?? colors.primary} size={64} />
          <View style={styles.flex}>
            <AppText variant="title">{name}</AppText>
            <AppText tone="muted">{email}</AppText>
            {account && (
              <Badge
                label={account.email_confirmed ? t('profile.emailConfirmed') : t('profile.emailNotConfirmed')}
                tone={account.email_confirmed ? 'success' : 'warning'}
                icon={account.email_confirmed ? 'checkmark-circle-outline' : 'alert-circle-outline'}
              />
            )}
          </View>
        </View>
      </Card>
      {update && (
        <Card padded={false}>
          <ListItem
            icon="download-outline"
            title={t('profile.updateAvailable', { version: update.version, build: update.build })}
            onPress={() => void Linking.openURL(update.url)}
          />
        </Card>
      )}
      <SectionHeader title={t('profile.account')} />
      <Card padded={false}>
        <ListItem
          icon="person-outline"
          title={t('profile.edit')}
          onPress={() => router.push('/settings/edit-profile')}
        />
        <ListItem
          icon="time-outline"
          title="Minha rotina"
          subtitle="Trabalho, estudos, sono e seus horários livres"
          onPress={() => router.push('/settings/routine')}
        />

        <ListItem
          icon="options-outline"
          title={t('profile.preferences')}
          onPress={() => router.push('/settings/preferences')}
        />
        <ListItem
          icon="notifications-outline"
          title={t('profile.notifications')}
          onPress={() => router.push('/settings/notifications')}
        />
        <ListItem
          icon="phone-portrait-outline"
          title={t('profile.devices')}
          onPress={() => router.push('/settings/devices')}
        />
        <ListItem
          icon="lock-closed-outline"
          title={t('profile.password')}
          onPress={() => router.push('/settings/password')}
        />
        <ListItem
          icon="shield-checkmark-outline"
          title={t('profile.privacy')}
          onPress={() => router.push('/settings/privacy-data')}
        />
      </Card>
      <SectionHeader title={t('profile.app')} />
      <Card padded={false}>
        <ListItem
          icon="sync-outline"
          title={t('profile.sync')}
          subtitle={pending ? t('sync.pending', { n: pending }) : undefined}
          onPress={() => router.push('/sync')}
        />
        <ListItem icon="help-circle-outline" title={t('profile.help')} onPress={() => router.push('/help')} />
        <ListItem
          icon="document-text-outline"
          title={t('profile.privacyPolicy')}
          onPress={() => router.push('/privacy')}
        />
        <ListItem
          icon="bug-outline"
          title={t('profile.diagnostics')}
          onPress={() => router.push('/diagnostics')}
        />
      </Card>
      <Card padded={false}>
        <ListItem icon="log-out-outline" title={t('auth.logout')} danger onPress={logout} chevron={false} />
      </Card>
      <View style={styles.about} accessibilityRole="summary">
        <Logo kind="vertical" width={160} />
        <View style={[styles.rule, { backgroundColor: colors.bronze }]} />
        <AppText variant="small" tone="bronze" center>
          {marca.assinatura}
        </AppText>
        <AppText variant="caption" tone="muted" center>
          {t('profile.about', { version: env.appVersion, build: env.appBuild })}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, lineHeight: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  about: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  rule: { width: 40, height: 1, marginTop: spacing.sm },
  flex: { flex: 1, gap: spacing.xs },
});
