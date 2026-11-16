import { useScreenFocus } from '@/hooks/useScreenFocus';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { SCREEN_MARGIN, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { GlassSphere, Kairo, OrbitSymbol, useDecorSize } from './brand/Decor';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { EnterItem } from './motion';
import { ScreenSkeleton, type SkeletonKind } from './Skeleton';

/**
 * Enquanto os dados chegam, o esqueleto da tela aparece no lugar do conteúdo
 * (nunca uma tela em branco ou um aviso por cima). Esperas curtas quase não
 * se notam: o esqueleto surge num esmaecer rápido, depois de um instante.
 */
export function LoadingState({
  message,
  kind = 'list',
  safeTop,
}: {
  message?: string;
  /** Formato do esqueleto: Hoje, lista (padrão), formulário ou só linhas (dentro de uma tela). */
  kind?: SkeletonKind;
  /** A tela não tem barra de título: respeita a área do topo. */
  safeTop?: boolean;
}) {
  const { colors, reduceMotion } = useAppTheme();
  const label = message ?? t('common.loading');
  const shown = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    shown.set(withDelay(90, withTiming(1, { duration: 180 })));
  }, [shown]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Animated.View
      style={[kind === 'rows' ? null : styles.fill, { backgroundColor: colors.background }, fade]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      {message ? (
        <AppText variant="small" tone="muted" style={styles.message}>
          {message}
        </AppText>
      ) : null}
      <ScreenSkeleton kind={kind} safeTop={safeTop && !message} />
    </Animated.View>
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
  fill: { flex: 1 },
  message: { paddingHorizontal: SCREEN_MARGIN, paddingTop: spacing.lg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.lg,
    minHeight: 240,
  },
  art: { alignItems: 'center', marginBottom: spacing.sm },
  texts: { gap: spacing.sm, alignItems: 'center', maxWidth: 360 },
  actions: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  iconTile: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
