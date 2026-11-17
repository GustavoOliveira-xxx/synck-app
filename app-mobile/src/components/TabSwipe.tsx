// Arrastar a tela para o lado troca de aba (só no celular, com as abas
// embaixo). A tela acompanha o dedo, resiste quando não há aba vizinha e,
// solta, vai para a vizinha ou volta quicando. Listas e calendários que já
// usam o arrasto lateral têm prioridade: o gesto só chega aqui se ninguém
// dentro da tela quiser.
//
// No navegador (site e app instalado no iPhone) a pilha de telas não tem
// transição própria: ao voltar de uma tela interna, a aba entra deslizando
// da esquerda com mola, como o Android faz ao voltar.
import { usePathname } from 'expo-router';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { PanResponder, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useAppTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';
import { isReturnToTab, swipeTarget } from '@/utils/motion';

import { tapFeedback } from './motion';

/** Quanto a tela anda em relação ao dedo (a aba nova chega pela transição). */
const FOLLOW = 0.4;
/** Resistência na ponta, quando não há aba para aquele lado. */
const EDGE = 0.15;

export function TabSwipe({
  children,
  index,
  count,
  enabled,
  onSwipe,
  path,
  tabPaths,
}: {
  children: ReactNode;
  index: number;
  count: number;
  enabled: boolean;
  onSwipe: (next: number) => void;
  /** Endereço desta aba. */
  path: string;
  /** Endereços de todas as abas. */
  tabPaths: string[];
}) {
  const { reduceMotion } = useAppTheme();
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const pathname = usePathname();
  const previous = useRef(pathname);
  useEffect(() => {
    const was = previous.current;
    previous.current = pathname;
    if (Platform.OS !== 'web' || reduceMotion) return;
    if (!isReturnToTab(was, pathname, path, tabPaths)) return;
    x.set(-Math.min(width, 520) * 0.3);
    x.set(withSpring(0, motion.molaEntrada));
  }, [pathname, path, tabPaths, reduceMotion, width, x]);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          enabled && index >= 0 && Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
        onPanResponderTerminationRequest: () => true,
        onPanResponderMove: (_, g) => {
          if (reduceMotion) return;
          const next = swipeTarget(index, count, g.dx);
          x.set(g.dx * (next == null ? EDGE : FOLLOW));
        },
        onPanResponderRelease: (_, g) => {
          const next = swipeTarget(index, count, g.dx);
          const go = next != null && (Math.abs(g.dx) > width * 0.25 || Math.abs(g.vx) > 0.5);
          x.set(withSpring(0, go ? motion.molaRapida : motion.molaEntrada));
          if (go) {
            tapFeedback('select');
            onSwipe(next);
          }
        },
        onPanResponderTerminate: () => x.set(withSpring(0, motion.molaEntrada)),
      }),
    [enabled, index, count, width, reduceMotion, onSwipe, x],
  );
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Animated.View testID={`aba-${index}`} style={[styles.fill, style]} {...responder.panHandlers}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
