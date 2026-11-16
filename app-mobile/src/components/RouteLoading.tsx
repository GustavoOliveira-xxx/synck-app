// Troca de tela demorada: uma barra fina e elástica corre no topo, sem cobrir
// nada. A tela nova recebe toques normalmente e mostra o próprio esqueleto
// enquanto os dados chegam.
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { t } from '@/i18n';
import { endNavigation, useNavigationLoading } from '@/stores/navigationLoadingStore';
import { useAppTheme } from '@/theme/ThemeProvider';
import { motion, radius, spacing } from '@/theme/tokens';

export function RouteLoading({ enabled }: { enabled: boolean }) {
  const path = usePathname();
  const params = useGlobalSearchParams();
  const destination = JSON.stringify([path, params]);
  const previous = useRef(destination);
  const pending = useNavigationLoading((s) => s.pending);
  const visible = useDelayedLoading(enabled && pending);

  // Chegou na tela nova: a espera da navegação acabou.
  useEffect(() => {
    if (previous.current === destination) return;
    previous.current = destination;
    endNavigation();
  }, [destination]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') endNavigation();
    });
    return () => {
      sub.remove();
      endNavigation();
    };
  }, []);

  return visible ? <TopBar /> : null;
}

function TopBar() {
  const { colors, reduceMotion } = useAppTheme();
  const insets = useSafeAreaInsets();
  const run = useSharedValue(0);
  const show = useSharedValue(0);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    show.set(withSpring(1, motion.molaEntrada));
    if (!reduceMotion)
      run.set(withRepeat(withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.cubic) }), -1));
    return () => cancelAnimation(run);
  }, [run, show, reduceMotion]);
  const track = useAnimatedStyle(() => ({
    opacity: Math.min(show.value, 1),
    transform: [{ scaleY: show.value }],
  }));
  // O trecho cheio corre da esquerda para a direita, esticando no meio do caminho.
  const bar = useAnimatedStyle(() => ({
    transform: [
      { translateX: (run.value * 1.4 - 0.4) * width },
      { scaleX: 0.6 + Math.sin(run.value * Math.PI) * 0.8 },
    ],
  }));
  return (
    <View
      testID="route-loading"
      pointerEvents="none"
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      style={[styles.wrap, { top: insets.top + spacing.xs }]}
    >
      <Animated.View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.track, { backgroundColor: colors.primarySoft }, track]}
      >
        <Animated.View
          style={[styles.bar, { backgroundColor: colors.primary }, reduceMotion ? styles.still : bar]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.xl, right: spacing.xl, zIndex: 50 },
  track: { height: 3, borderRadius: radius.pill, overflow: 'hidden' },
  bar: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '40%', borderRadius: radius.pill },
  still: { left: '30%' },
});
