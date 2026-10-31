import { StyleSheet, View } from 'react-native';

import { useScreenFocus } from '@/hooks/useScreenFocus';
import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { BrandMark } from './brand/BrandMark';
import { GlassSphere, Kairo, OrbitRings, OrbitSymbol, useDecorSize } from './brand/Decor';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { EnterItem } from './motion';

/** Carregando: o personagem SynCK flutua dentro dos anéis de órbita. */
export function LoadingState({ message }: { message?: string }) {
  const focused = useScreenFocus();
  return (
    <View
      style={styles.center}
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? t('common.loading')}
    >
      <View style={styles.loader}>
        <OrbitRings size={120} paused={!focused} style={StyleSheet.absoluteFill} />
        <BrandMark size={72} halo={false} />
      </View>
      <AppText tone="muted">{message ?? t('common.loading')}</AppText>
    </View>
  );
}

export type EmptyArt = 'kairo' | 'orbit' | 'sphere' | 'icon';

export function EmptyState({
  icon = 'calendar-clear-outline',
  art = 'kairo',
  title,
  message,
  actionLabel,
  onAction,
  actionIcon,
  secondaryLabel,
  onSecondary,
}: {
  icon?: IconName;
  /** Ilustração: Kairo (padrão), símbolo Órbita, esfera de vidro ou só o ícone. */
  art?: EmptyArt;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: IconName;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const { colors } = useAppTheme();
  const size = useDecorSize('empty');
  const focused = useScreenFocus();
  return (
    <View style={styles.center}>
      <EnterItem index={0} style={styles.art}>
        {art === 'kairo' && <Kairo size={size} paused={!focused} />}
        {art === 'orbit' && <OrbitSymbol size={size} paused={!focused} />}
        {art === 'sphere' && <GlassSphere size={size * 1.1} paused={!focused} />}
        {art === 'icon' && (
          <View style={[styles.iconTile, { backgroundColor: colors.primarySoft }]}>
            <Icon name={icon} size={36} color={colors.primaryInk} />
          </View>
        )}
      </EnterItem>
      <EnterItem index={1} style={styles.texts}>
        <AppText variant="title" center accessibilityRole="header">
          {title}
        </AppText>
        {message ? (
          <AppText tone="muted" center>
            {message}
          </AppText>
        ) : null}
      </EnterItem>
      {(actionLabel && onAction) || (secondaryLabel && onSecondary) ? (
        <EnterItem index={2} style={styles.actions}>
          {actionLabel && onAction ? (
            <Button title={actionLabel} onPress={onAction} icon={actionIcon ?? 'add'} compact />
          ) : null}
          {secondaryLabel && onSecondary ? (
            <Button title={secondaryLabel} onPress={onSecondary} variant="ghost" compact />
          ) : null}
        </EnterItem>
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <View style={[styles.iconTile, { backgroundColor: colors.dangerSoft }]}>
        <Icon name="alert-circle-outline" size={36} color={colors.danger} />
      </View>
      <AppText variant="heading" center>
        {t('errors.genericTitle')}
      </AppText>
      <AppText tone="muted" center>
        {message}
      </AppText>
      {onRetry ? <Button title={t('common.retry')} onPress={onRetry} icon="refresh" compact /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.lg,
    minHeight: 240,
  },
  art: { alignItems: 'center', marginBottom: spacing.sm },
  loader: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  texts: { gap: spacing.sm, alignItems: 'center', maxWidth: 360 },
  actions: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  iconTile: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
