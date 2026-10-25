// Abertura SynCK (depois da splash nativa): logo vertical a 60% da largura,
// barra de progresso fina em `primary`, fitas de névoa no fundo e a
// assinatura "um produto CK Group" com filete bronze.
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { MotionView } from '../motion';

import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { marca } from '@/theme/marca';
import { fonte, radius, spacing } from '@/theme/tokens';

import { AppText } from '../AppText';
import { MistRibbons } from './Decor';
import { Logo } from './Logo';

export function BrandSplash() {
  const { colors, reduceMotion } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const logo = Math.min(width * 0.6, 320);
  const bar = Math.min(width * 0.32, 160);
  const progress = useSharedValue(0);
  const appear = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    appear.value = withTiming(1, { duration: 420, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
    progress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
  }, [appear, progress]);
  const fill = useAnimatedStyle(() => ({ width: bar * (0.25 + 0.75 * progress.value) }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.94 + 0.06 * appear.value }],
  }));

  return (
    <MotionView
      exiting={FadeOut.duration(240)}
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.background }]}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.opening')}
      testID="abertura"
    >
      <MistRibbons width={width} height={height * 0.5} style={styles.mist} />
      <Animated.View style={logoStyle}>
        <Logo kind="vertical" width={logo} />
      </Animated.View>
      <View style={[styles.track, { width: bar, backgroundColor: colors.primarySoft }]}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.primary }, fill]} />
      </View>
      <View style={styles.footer}>
        <View style={[styles.rule, { backgroundColor: colors.bronze }]} />
        <AppText variant="small" tone="bronze">
          {marca.assinatura.replace('CK Group', '')}
          <AppText variant="small" tone="bronze" style={styles.bold}>
            CK Group
          </AppText>
        </AppText>
      </View>
    </MotionView>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', gap: spacing.xxxl, zIndex: 10 },
  mist: { position: 'absolute', bottom: 0, left: 0 },
  track: { height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 4, borderRadius: radius.pill },
  footer: { position: 'absolute', bottom: spacing.huge, alignItems: 'center', gap: spacing.sm },
  rule: { width: 40, height: 1 },
  bold: fonte('negrito'),
});
