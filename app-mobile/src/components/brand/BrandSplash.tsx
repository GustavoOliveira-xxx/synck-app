// Abertura SynCK (depois da splash nativa e da vinheta da CK): a esfera de
// vidro do logo enche de líquido conforme cada etapa termina de verdade
// (fontes, sessão, dados do aparelho). Cheia, ela brilha, cresce até cobrir a
// tela e o app aparece por trás. Se tudo já está pronto, isso leva menos de
// um segundo; a abertura nunca segura o app depois que ele está pronto.
//
// Desempenho: só transformação e opacidade na thread de interface. As ondas
// ficam paradas no modo leve; com "reduzir movimento", só um esmaecer.
import { useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useAppTheme } from '@/theme/ThemeProvider';
import { CORES_DO_LOGO, marca } from '@/theme/marca';
import { fonte, motion, spacing } from '@/theme/tokens';
import { openingStage } from '@/utils/motion';

import { AppText } from '../AppText';
import { EnterItem } from '../motion';
import { MistRibbons } from './Decor';

/** Onda que se repete a cada meia largura, para o laço não ter emenda. */
function wavePath(width: number, amp: number): string {
  const step = width / 4;
  let d = `M 0 ${amp}`;
  for (let i = 0; i < 4; i++) {
    const x = i * step;
    d += ` Q ${x + step / 2} ${i % 2 ? amp * 2 : 0} ${x + step} ${amp}`;
  }
  return `${d} L ${width} ${amp * 2 + 400} L 0 ${amp * 2 + 400} Z`;
}

const STAR = 'M 50 20 C 52 38 58 44 76 46 C 58 48 52 54 50 72 C 48 54 42 48 24 46 C 42 44 48 38 50 20 Z';

export function BrandSplash({
  progress,
  hold,
  onDone,
}: {
  /** 0 a 1: quanto da abertura já terminou de verdade. */
  progress: number;
  /** A vinheta da CK ainda está tocando por cima: não sai antes dela. */
  hold: boolean;
  /** A abertura terminou de sair da frente. */
  onDone: () => void;
}) {
  const { colors, dark, reduceMotion, lite } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const size = Math.round(Math.min(width * 0.42, 176));
  const inner = size - 8;
  const wave = Math.round(inner * 2);

  const appear = useSharedValue(reduceMotion ? 1 : 0);
  const level = useSharedValue(0);
  const drift = useSharedValue(0);
  const spark = useSharedValue(0);
  const dive = useSharedValue(0);
  const fade = useSharedValue(1);
  const leaving = useRef(false);

  useEffect(() => {
    appear.set(withSpring(1, motion.mola));
  }, [appear]);

  useEffect(() => {
    level.set(
      reduceMotion ? withTiming(progress, { duration: 150 }) : withSpring(progress, motion.molaEntrada),
    );
  }, [progress, reduceMotion, level]);

  useEffect(() => {
    if (lite) return;
    drift.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1));
    return () => cancelAnimation(drift);
  }, [lite, drift]);

  useEffect(() => {
    if (progress < 1 || hold || leaving.current) return;
    leaving.current = true;
    const finish = () => onDone();
    if (reduceMotion) {
      fade.set(withTiming(0, { duration: 160 }, (ok) => ok && runOnJS(finish)()));
      return;
    }
    const cover = (Math.hypot(width, height) / size) * 1.15;
    spark.set(withDelay(260, withSpring(1, motion.mola)));
    dive.set(
      withDelay(
        420,
        withSequence(
          withTiming(-0.06, { duration: 110 }),
          withTiming(cover, { duration: 460, easing: Easing.in(Easing.cubic) }),
        ),
      ),
    );
    fade.set(
      withDelay(
        820,
        withTiming(0, { duration: 220 }, (ok) => ok && runOnJS(finish)()),
      ),
    );
  }, [progress, hold, reduceMotion, width, height, size, spark, dive, fade, onDone]);

  const orbStyle = useAnimatedStyle(() => {
    const d = dive.value;
    // Antes de crescer, a esfera achata de leve (toma impulso).
    const squashX = d < 0 ? 1 - d * 1.5 : 1;
    const squashY = d < 0 ? 1 + d * 2 : 1;
    const grow = d > 0 ? 1 + d : 1;
    return {
      opacity: Math.min(appear.value, 1),
      transform: [{ scale: (0.3 + 0.7 * appear.value) * grow }, { scaleX: squashX }, { scaleY: squashY }],
    };
  });
  const liquidStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: inner * 0.06 + (1 - Math.min(Math.max(level.value, 0), 1.05)) * inner * 0.94 }],
  }));
  const frontWave = useAnimatedStyle(() => ({ transform: [{ translateX: -drift.value * (wave / 2) }] }));
  const backWave = useAnimatedStyle(() => ({
    transform: [{ translateX: -((drift.value * 0.6 + 0.3) % 1) * (wave / 2) }],
  }));
  // Brilho e estrela somem quando a esfera começa a crescer: só o líquido cobre a tela.
  const shineStyle = useAnimatedStyle(() => ({ opacity: dive.value > 0.15 ? 0 : 1 }));
  const sparkStyle = useAnimatedStyle(() => ({
    opacity: dive.value > 0.15 ? 0 : Math.min(spark.value, 1),
    transform: [{ scale: spark.value }, { rotate: `${(1 - spark.value) * -90}deg` }],
  }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const textStyle = useAnimatedStyle(() => ({ opacity: dive.value > 0.2 ? 0 : 1 }));

  const rim = dark ? CORES_DO_LOGO.nevoa : CORES_DO_LOGO.abismo;
  const stage = openingStage(progress);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.background }, rootStyle]}
      accessibilityRole="progressbar"
      accessibilityLabel={stage}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      testID="abertura"
    >
      <MistRibbons width={width} height={height * 0.4} paused={lite} style={styles.mist} />
      <Animated.View
        style={[
          styles.orb,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: rim,
            backgroundColor: colors.surface,
          },
          orbStyle,
        ]}
      >
        <View style={[styles.glass, { width: inner, height: inner, borderRadius: inner / 2 }]}>
          <Animated.View style={[styles.liquid, { height: inner * 1.2 }, liquidStyle]}>
            <Animated.View style={[styles.wave, { width: wave, height: inner * 1.2 }, backWave]}>
              <Svg width={wave} height={inner * 1.2}>
                <Path d={wavePath(wave, 7)} fill={CORES_DO_LOGO.nevoa} />
              </Svg>
            </Animated.View>
            <Animated.View style={[styles.wave, { top: 6, width: wave, height: inner * 1.2 }, frontWave]}>
              <Svg width={wave} height={inner * 1.2}>
                <Path d={wavePath(wave, 6)} fill={dark ? CORES_DO_LOGO.jade : CORES_DO_LOGO.teal} />
              </Svg>
            </Animated.View>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, shineStyle]}>
            <Svg width={inner} height={inner} viewBox="0 0 100 100">
              <Path
                d="M 22 40 A 30 30 0 0 1 42 20"
                stroke={CORES_DO_LOGO.branco}
                strokeWidth={4.5}
                strokeLinecap="round"
                fill="none"
                opacity={0.85}
              />
            </Svg>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, sparkStyle]}>
            <Svg width={inner} height={inner} viewBox="0 0 100 100">
              <Path d={STAR} fill={CORES_DO_LOGO.branco} />
            </Svg>
          </Animated.View>
        </View>
      </Animated.View>
      <Animated.View style={[styles.stage, textStyle]}>
        <EnterItem key={stage} distance={10}>
          <AppText tone="muted" style={fonte('semi')}>
            {stage}
          </AppText>
        </EnterItem>
      </Animated.View>
      <Animated.View style={[styles.footer, textStyle]}>
        <View style={[styles.rule, { backgroundColor: colors.bronze }]} />
        <AppText variant="small" tone="bronze">
          {marca.assinatura.replace('CK Group', '')}
          <AppText variant="small" tone="bronze" style={styles.bold}>
            CK Group
          </AppText>
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', gap: spacing.xxl, zIndex: 10 },
  mist: { position: 'absolute', bottom: 0, left: 0 },
  orb: { borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  glass: { overflow: 'hidden' },
  liquid: { position: 'absolute', left: 0, right: 0, top: 0 },
  wave: { position: 'absolute', left: 0, top: 0 },
  stage: { height: 24, overflow: 'hidden' },
  footer: { position: 'absolute', bottom: spacing.huge, alignItems: 'center', gap: spacing.sm },
  rule: { width: 40, height: 1 },
  bold: fonte('negrito'),
});
