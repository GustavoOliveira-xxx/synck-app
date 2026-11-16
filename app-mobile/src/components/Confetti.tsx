// Confete nas cores das agendas, para comemorar uma conclusão. Um único valor
// animado move todas as partículas (só transformação e opacidade). No modo
// leve não desenha nada.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { create } from 'zustand';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { CORES_DE_AGENDA } from '@/theme/marca';
import { useAppTheme } from '@/theme/ThemeProvider';
import { confettiParticles } from '@/utils/motion';

const COUNT = 14;
const DURATION = 900;

const PARTICLES = confettiParticles(COUNT, CORES_DE_AGENDA.length);

function Particle({ t, index, color }: { t: SharedValue<number>; index: number; color: string }) {
  const p = PARTICLES[index];
  const style = useAnimatedStyle(() => {
    const k = t.value;
    // Sai rápido do centro, desacelera e cai um pouco no fim.
    const out = 1 - (1 - Math.min(k / 0.45, 1)) ** 3;
    const fall = Math.max(0, k - 0.45) * 60;
    return {
      opacity: k <= 0 || k >= 1 ? 0 : k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3,
      transform: [
        { translateX: p.dx * out * (1 + 0.25 * Math.max(0, k - 0.45)) },
        { translateY: p.dy * out + fall },
        { rotate: `${p.spin * k}deg` },
        { scale: k < 0.15 ? 0.4 + 4 * k : 1 - 0.3 * k },
      ],
    };
  });
  return (
    <Animated.View style={[styles.particle, p.round && styles.round, { backgroundColor: color }, style]} />
  );
}

/** Coloque dentro de um elemento com posição relativa; o confete sai do centro dele. */
export function Confetti({ trigger }: { trigger: number }) {
  const { dark, lite } = useAppTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!trigger || lite) return;
    t.set(0);
    t.set(withTiming(1, { duration: DURATION, easing: Easing.linear }));
  }, [trigger, lite, t]);
  if (lite || !trigger) return null;
  return (
    <View pointerEvents="none" style={styles.origin}>
      {PARTICLES.map((p, i) => {
        const c = CORES_DE_AGENDA[p.color];
        return <Particle key={i} t={t} index={i} color={dark ? c.escuro : c.claro} />;
      })}
    </View>
  );
}

// Camada de comemorações por cima do app: a linha que foi concluída pode sair
// da lista na hora (filtros), e o confete continua no lugar onde ela estava.
let nextBurst = 1;
const useBursts = create<{ bursts: { id: number; x: number; y: number }[] }>(() => ({ bursts: [] }));

/** Solta confete no ponto (x, y) da janela. */
export function celebrateAt(x: number, y: number) {
  const id = nextBurst++;
  useBursts.setState((s) => ({ bursts: [...s.bursts, { id, x, y }] }));
  setTimeout(
    () => useBursts.setState((s) => ({ bursts: s.bursts.filter((b) => b.id !== id) })),
    DURATION + 100,
  );
}

/** Fica na raiz do app, por cima de tudo. */
export function ConfettiLayer() {
  const bursts = useBursts((s) => s.bursts);
  if (!bursts.length) return null;
  return (
    <View pointerEvents="none" style={styles.layer}>
      {bursts.map((b) => (
        <View key={b.id} style={[styles.point, { left: b.x, top: b.y }]}>
          <Confetti trigger={b.id} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: 100 },
  point: { position: 'absolute', width: 0, height: 0 },
  origin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
    overflow: 'visible',
    zIndex: 5,
  },
  particle: { position: 'absolute', left: -3.5, top: -3.5, width: 7, height: 7, borderRadius: 2 },
  round: { borderRadius: 4 },
});
