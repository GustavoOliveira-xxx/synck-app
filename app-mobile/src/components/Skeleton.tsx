// Esqueleto vivo: o desenho da tela aparece na hora, no lugar onde o conteúdo
// vai ficar, e um brilho passa por ele enquanto os dados chegam. Quando o
// conteúdo chega, ele cai no lugar com a entrada elástica das telas.
//
// Desempenho: um único valor animado move o brilho de todos os blocos, só
// com transformação. No modo leve o esqueleto fica parado.
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useScreenFocus } from '@/hooks/useScreenFocus';
import { useAppTheme } from '@/theme/ThemeProvider';
import { radius, SCREEN_MARGIN, spacing } from '@/theme/tokens';
import { CONTENT_MAX_WIDTH } from '@/utils/layout';

const Shine = createContext<SharedValue<number> | null>(null);

/** Bloco cinza-maré no formato do conteúdo que vai chegar. */
export function Bone({
  width = '100%',
  height,
  round = radius.md,
  style,
}: {
  width?: DimensionValue;
  height: number;
  round?: number;
  style?: ViewStyle;
}) {
  const { colors, dark } = useAppTheme();
  const shine = useContext(Shine);
  const { width: screen } = useWindowDimensions();
  const sweep = Math.min(screen, CONTENT_MAX_WIDTH);
  const glow = useAnimatedStyle(() => ({
    transform: [{ translateX: shine ? -sweep * 0.6 + shine.value * sweep * 2.2 : -sweep }],
  }));
  return (
    <View
      style={[styles.bone, { width, height, borderRadius: round, backgroundColor: colors.surfaceAlt }, style]}
    >
      {shine && (
        <Animated.View style={[styles.glow, { width: sweep * 0.6 }, glow]}>
          <LinearGradient
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            colors={['transparent', dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

/** Fornece o brilho que corre pelos blocos de dentro. */
function ShineProvider({ children }: { children: ReactNode }) {
  const { lite } = useAppTheme();
  const focused = useScreenFocus();
  const t = useSharedValue(0);
  const running = focused && !lite;
  useEffect(() => {
    if (!running) {
      cancelAnimation(t);
      return;
    }
    t.set(0);
    t.set(
      withRepeat(withDelay(150, withTiming(1, { duration: 1150, easing: Easing.inOut(Easing.quad) })), -1),
    );
    return () => cancelAnimation(t);
  }, [running, t]);
  return <Shine.Provider value={running ? t : null}>{children}</Shine.Provider>;
}

export type SkeletonKind = 'list' | 'today' | 'form' | 'rows';

/**
 * Esqueleto de uma tela inteira (Hoje, lista ou formulário) ou só das linhas de
 * uma lista dentro de uma tela que já tem título e margens (`rows`).
 */
export function ScreenSkeleton({ kind = 'list', safeTop }: { kind?: SkeletonKind; safeTop?: boolean }) {
  const embedded = kind === 'rows';
  const insets = useSafeAreaInsets();
  return (
    <ShineProvider>
      <View
        style={
          embedded
            ? styles.rows
            : [
                styles.page,
                { paddingTop: (safeTop ? insets.top : 0) + spacing.lg, maxWidth: CONTENT_MAX_WIDTH },
              ]
        }
      >
        {kind === 'rows' && (
          <>
            <Bone height={64} />
            <Bone height={64} />
            <Bone height={64} />
          </>
        )}
        {kind === 'today' && (
          <>
            <Bone width="45%" height={12} round={6} />
            <Bone width="62%" height={28} round={8} />
            <Bone width={190} height={26} round={radius.pill} />
            <Bone height={64} />
            <Bone height={112} />
            <Bone width="38%" height={16} round={6} style={styles.section} />
            <Bone height={60} />
            <Bone height={60} />
            <Bone height={60} />
          </>
        )}
        {kind === 'list' && (
          <>
            <Bone width="30%" height={12} round={6} />
            <Bone width="55%" height={26} round={8} />
            <View style={styles.chips}>
              <Bone width={72} height={32} round={radius.pill} />
              <Bone width={64} height={32} round={radius.pill} />
              <Bone width={96} height={32} round={radius.pill} />
            </View>
            <Bone height={64} />
            <Bone height={64} />
            <Bone height={64} />
            <Bone height={64} />
            <Bone height={64} />
          </>
        )}
        {kind === 'form' && (
          <>
            <Bone height={52} round={radius.sm} />
            <Bone height={52} round={radius.sm} />
            <Bone height={96} round={radius.sm} />
            <Bone height={52} round={radius.sm} />
            <Bone height={48} round={radius.pill} style={styles.section} />
          </>
        )}
      </View>
    </ShineProvider>
  );
}

const styles = StyleSheet.create({
  bone: { overflow: 'hidden' },
  glow: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  page: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: SCREEN_MARGIN,
    gap: spacing.md,
  },
  rows: { gap: spacing.md },
  section: { marginTop: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm },
});
