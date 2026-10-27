import { SvgArtwork } from '../Icon';
// Decoração SynCK derivada do logo: esfera de vidro com névoa girando,
// anéis de órbita com satélites, mascote Kairo, estrela de quatro pontas e
// fitas de névoa. Desenhada em camadas (vidro, névoa, brilho, anel da frente)
// para dar profundidade, com luz vinda de cima à esquerda.
//
// Regras do guia de identidade:
// - tamanho sempre proporcional à largura da tela (useDecorSize);
// - menos de 360 dp de largura: 15% menor; tablets e computador: no máximo 420;
// - uma animação por tela, parada fora de foco, em segundo plano e com
//   "reduzir movimento" (aí aparece a versão estática).
import { useEffect, useState } from 'react';
import {
  AppState,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useAppTheme } from '@/theme/ThemeProvider';
import { CORES_DO_LOGO } from '@/theme/marca';

const L = CORES_DO_LOGO;

export type DecorKind = 'hero' | 'header' | 'empty';

/** Tamanho proporcional à largura: destaque 60%, cabeçalho 32%, estado vazio 40%. */
export function useDecorSize(kind: DecorKind): number {
  const { width } = useWindowDimensions();
  const share = { hero: 0.6, header: 0.32, empty: 0.4 }[kind];
  // Em telas largas a referência é a coluna de conteúdo (até 720), não a janela.
  let size = Math.min(width, 720) * share;
  if (width < 360) size *= 0.85;
  return Math.round(Math.min(size, 420));
}

/** O app está em primeiro plano? */
function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/** Animação ligada? Desliga com "reduzir movimento", app em segundo plano ou `paused`. */
function useAnimating(paused?: boolean): boolean {
  const { reduceMotion } = useAppTheme();
  const appActive = useAppActive();
  return !reduceMotion && appActive && !paused;
}

/** Valor que gira de 0 a 1 sem parar (ou vai e volta, com `yoyo`). */
function useLoop(duration: number, running: boolean, yoyo = false): SharedValue<number> {
  const v = useSharedValue(0);
  useEffect(() => {
    if (!running) {
      cancelAnimation(v);
      return;
    }
    v.value = withRepeat(
      withTiming(yoyo ? 1 : v.value + 1, {
        duration,
        easing: yoyo ? Easing.inOut(Easing.sin) : Easing.linear,
      }),
      -1,
      yoyo,
    );
    return () => cancelAnimation(v);
  }, [running, duration, yoyo, v]);
  return v;
}

/** Piscar de olhos: fecha rápido a cada ~4 s. */
function useBlink(running: boolean): SharedValue<number> {
  const v = useSharedValue(1);
  useEffect(() => {
    if (!running) {
      cancelAnimation(v);
      v.value = 1;
      return;
    }
    v.value = withRepeat(
      withSequence(withDelay(3600, withTiming(0.12, { duration: 70 })), withTiming(1, { duration: 110 })),
      -1,
    );
    return () => cancelAnimation(v);
  }, [running, v]);
  return v;
}

// -------------------------------------------------------------------------
// Satélites em órbita: posição calculada numa elipse inclinada. Atrás da
// esfera na metade de cima, na frente na metade de baixo.
// -------------------------------------------------------------------------

interface Orbit {
  /** Centro e raios da elipse, em fração do tamanho do objeto. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Inclinação em graus. */
  tilt: number;
}

function Satellite({
  orbit,
  size,
  t,
  phase,
  dot,
  color,
  ring,
  layer,
}: {
  orbit: Orbit;
  size: number;
  t: SharedValue<number>;
  phase: number;
  dot: number;
  color: string;
  ring?: string;
  layer: 'back' | 'front';
}) {
  const style = useAnimatedStyle(() => {
    const a = (t.value + phase) * Math.PI * 2;
    const ex = Math.cos(a) * orbit.rx * size;
    const ey = Math.sin(a) * orbit.ry * size;
    const r = (orbit.tilt * Math.PI) / 180;
    const x = orbit.cx * size + ex * Math.cos(r) - ey * Math.sin(r);
    const y = orbit.cy * size + ex * Math.sin(r) + ey * Math.cos(r);
    const front = Math.sin(a) >= 0;
    const visible = layer === 'front' ? front : !front;
    // Mais perto (embaixo) parece maior: perspectiva simples.
    const scale = 0.82 + 0.18 * (Math.sin(a) + 1) * 0.5;
    return {
      opacity: visible ? 1 : 0,
      transform: [{ translateX: x - dot / 2 }, { translateY: y - dot / 2 }, { scale }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.satellite,
        { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color },
        ring ? { borderWidth: Math.max(1.5, dot * 0.18), borderColor: ring } : null,
        style,
      ]}
    />
  );
}

function RingArc({
  orbit,
  size,
  half,
  stroke,
  width,
  opacity = 1,
}: {
  orbit: Orbit;
  size: number;
  half: 'back' | 'front';
  stroke: string;
  width: number;
  opacity?: number;
}) {
  const cx = orbit.cx * size;
  const cy = orbit.cy * size;
  const rx = orbit.rx * size;
  const ry = orbit.ry * size;
  // Metade de cima (atrás) e de baixo (na frente) da elipse.
  const d =
    half === 'back'
      ? `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`
      : `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <G rotation={orbit.tilt} origin={`${cx}, ${cy}`}>
        <Path d={d} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" opacity={opacity} />
      </G>
    </Svg>
  );
}

// -------------------------------------------------------------------------
// Esfera de vidro com névoa girando dentro (splash, onboarding, dia livre).
// -------------------------------------------------------------------------

/** Névoa: fitas de menta e jade que giram dentro do vidro. */
function MistSwirl({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M8 58 C 22 34, 44 70, 58 48 S 86 30, 96 44 L 96 62 C 82 52, 70 76, 52 66 S 22 74, 8 72 Z"
        fill={L.nevoa}
        opacity={0.55}
      />
      <Path
        d="M4 34 C 20 20, 36 44, 52 30 S 78 16, 94 26 L 94 34 C 78 26, 64 46, 50 40 S 22 34, 4 44 Z"
        fill={L.jade}
        opacity={0.5}
      />
      <Path
        d="M18 82 C 34 70, 52 90, 70 78 S 88 74, 96 80 L 90 92 C 70 96, 40 98, 18 92 Z"
        fill={L.nevoa}
        opacity={0.35}
      />
      <Circle cx={30} cy={46} r={1.6} fill={L.branco} opacity={0.9} />
      <Circle cx={66} cy={60} r={1.1} fill={L.branco} opacity={0.8} />
      <Circle cx={58} cy={24} r={0.9} fill={L.branco} opacity={0.7} />
    </Svg>
  );
}

/** Estrela de quatro pontas (celebrações e brilhos). */
export function StarGlyph({ size, color }: { size: number; color: string }) {
  return <SvgArtwork name="brilho" size={size} color={color} />;
}

const SPHERE_ORBIT: Orbit = { cx: 0.5, cy: 0.56, rx: 0.47, ry: 0.12, tilt: -16 };

export function GlassSphere({
  size,
  paused,
  style,
  orbit = true,
}: {
  size: number;
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Anel com satélites em volta. */
  orbit?: boolean;
}) {
  const { colors, dark } = useAppTheme();
  const running = useAnimating(paused);
  const spin = useLoop(14000, running);
  const orbitT = useLoop(9000, running);
  const float = useLoop(2600, running, true);
  const twinkle = useLoop(1800, running, true);

  const sphere = size * 0.64;
  const core = sphere * 0.8;
  const top = size * 0.5 - sphere / 2 - size * 0.04;
  const left = (size - sphere) / 2;

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (float.value - 0.5) * size * 0.04 }],
  }));
  const mistStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const sparkStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * twinkle.value,
    transform: [{ scale: 0.7 + 0.3 * twinkle.value }],
  }));
  const ring = dark ? colors.mint : L.abismo;

  return (
    <View
      style={[{ width: size, height: size }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {orbit && (
        <RingArc
          orbit={SPHERE_ORBIT}
          size={size}
          half="back"
          stroke={ring}
          width={size * 0.018}
          opacity={0.45}
        />
      )}
      {orbit && (
        <Satellite
          orbit={SPHERE_ORBIT}
          size={size}
          t={orbitT}
          phase={0.1}
          dot={size * 0.06}
          color={L.nevoa}
          ring={ring}
          layer="back"
        />
      )}
      <Animated.View style={[StyleSheet.absoluteFill, floatStyle]}>
        {/* Sombra no chão */}
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Ellipse
            cx={size / 2}
            cy={size * 0.93}
            rx={sphere * 0.36}
            ry={size * 0.025}
            fill={L.abismo}
            opacity={dark ? 0.35 : 0.12}
          />
        </Svg>
        {/* Vidro */}
        <Svg width={sphere} height={sphere} viewBox="0 0 100 100" style={{ position: 'absolute', top, left }}>
          <Defs>
            <RadialGradient id="glass" cx="36%" cy="30%" r="78%">
              <Stop offset="0" stopColor={L.brilho} />
              <Stop offset="0.55" stopColor="#A6EBD6" />
              <Stop offset="1" stopColor="#2DB89C" />
            </RadialGradient>
            <RadialGradient id="core" cx="50%" cy="38%" r="68%">
              <Stop offset="0" stopColor={L.teal} />
              <Stop offset="1" stopColor={L.abismo} />
            </RadialGradient>
          </Defs>
          <Circle cx={50} cy={50} r={48} fill="url(#glass)" stroke={L.abismo} strokeWidth={2.2} />
          <Circle cx={50} cy={52} r={40} fill="url(#core)" />
        </Svg>
        {/* Névoa girando dentro */}
        <View
          style={{
            position: 'absolute',
            width: core,
            height: core,
            borderRadius: core / 2,
            overflow: 'hidden',
            top: top + (sphere - core) / 2 + sphere * 0.02,
            left: left + (sphere - core) / 2,
          }}
        >
          <Animated.View style={[{ width: core, height: core }, mistStyle]}>
            <MistSwirl size={core} />
          </Animated.View>
        </View>
        {/* Reflexo de luz (de cima à esquerda) */}
        <Svg width={sphere} height={sphere} viewBox="0 0 100 100" style={{ position: 'absolute', top, left }}>
          <Path
            d="M17 38 A 36 36 0 0 1 44 12"
            fill="none"
            stroke={L.branco}
            strokeWidth={4.5}
            strokeLinecap="round"
            opacity={0.9}
          />
          <Circle cx={15} cy={47} r={2.2} fill={L.branco} opacity={0.9} />
        </Svg>
        <Animated.View
          style={[{ position: 'absolute', top: top + sphere * 0.24, left: left + sphere * 0.56 }, sparkStyle]}
        >
          <StarGlyph size={sphere * 0.16} color={L.branco} />
        </Animated.View>
      </Animated.View>
      {orbit && <RingArc orbit={SPHERE_ORBIT} size={size} half="front" stroke={ring} width={size * 0.022} />}
      {orbit && (
        <Satellite
          orbit={SPHERE_ORBIT}
          size={size}
          t={orbitT}
          phase={0.1}
          dot={size * 0.06}
          color={L.nevoa}
          ring={ring}
          layer="front"
        />
      )}
      {orbit && (
        <>
          <Satellite
            orbit={SPHERE_ORBIT}
            size={size}
            t={orbitT}
            phase={0.62}
            dot={size * 0.075}
            color={colors.coral}
            ring={ring}
            layer="back"
          />
          <Satellite
            orbit={SPHERE_ORBIT}
            size={size}
            t={orbitT}
            phase={0.62}
            dot={size * 0.075}
            color={colors.coral}
            ring={ring}
            layer="front"
          />
        </>
      )}
      <Animated.View style={[{ position: 'absolute', top: size * 0.04, left: size * 0.5 }, sparkStyle]}>
        <StarGlyph size={size * 0.07} color={dark ? colors.mint : L.teal} />
      </Animated.View>
    </View>
  );
}

// -------------------------------------------------------------------------
// Anéis de órbita com satélites (cabeçalho da tela Hoje, Agendas).
// -------------------------------------------------------------------------

const RINGS: Orbit[] = [
  { cx: 0.5, cy: 0.5, rx: 0.46, ry: 0.17, tilt: -18 },
  { cx: 0.5, cy: 0.5, rx: 0.34, ry: 0.11, tilt: 14 },
];

export function OrbitRings({
  size,
  paused,
  style,
}: {
  size: number;
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, dark } = useAppTheme();
  const running = useAnimating(paused);
  const t1 = useLoop(12000, running);
  const t2 = useLoop(8000, running);
  const ink = dark ? colors.mint : colors.primary;
  const core = size * 0.2;
  return (
    <View
      style={[{ width: size, height: size }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <RingArc orbit={RINGS[0]} size={size} half="back" stroke={ink} width={1.5} opacity={0.3} />
      <RingArc orbit={RINGS[1]} size={size} half="back" stroke={ink} width={1.5} opacity={0.22} />
      <Satellite
        orbit={RINGS[0]}
        size={size}
        t={t1}
        phase={0}
        dot={size * 0.07}
        color={colors.coral}
        layer="back"
      />
      <Satellite
        orbit={RINGS[1]}
        size={size}
        t={t2}
        phase={0.4}
        dot={size * 0.05}
        color={colors.mint}
        layer="back"
      />
      <View
        style={{
          position: 'absolute',
          left: size / 2 - core / 2,
          top: size / 2 - core / 2,
          width: core,
          height: core,
          borderRadius: core / 2,
          backgroundColor: colors.primarySoft,
          borderWidth: 1.5,
          borderColor: dark ? colors.mint : colors.mint,
        }}
      />
      <RingArc orbit={RINGS[0]} size={size} half="front" stroke={ink} width={1.5} opacity={0.5} />
      <RingArc orbit={RINGS[1]} size={size} half="front" stroke={ink} width={1.5} opacity={0.38} />
      <Satellite
        orbit={RINGS[0]}
        size={size}
        t={t1}
        phase={0}
        dot={size * 0.07}
        color={colors.coral}
        layer="front"
      />
      <Satellite
        orbit={RINGS[1]}
        size={size}
        t={t2}
        phase={0.4}
        dot={size * 0.05}
        color={colors.mint}
        layer="front"
      />
      <Satellite
        orbit={RINGS[0]}
        size={size}
        t={t1}
        phase={0.55}
        dot={size * 0.045}
        color={colors.bronze}
        layer="back"
      />
      <Satellite
        orbit={RINGS[0]}
        size={size}
        t={t1}
        phase={0.55}
        dot={size * 0.045}
        color={colors.bronze}
        layer="front"
      />
    </View>
  );
}

// -------------------------------------------------------------------------
// Mascote Kairo (estados vazios) e símbolo Órbita.
// -------------------------------------------------------------------------

/** Kairo intermediário: flutua, pisca e o satélite coral dá a volta. */
export function Kairo({
  size,
  paused,
  style,
}: {
  size: number;
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, dark } = useAppTheme();
  const running = useAnimating(paused);
  const float = useLoop(2400, running, true);
  const blink = useBlink(running);
  const orbitT = useLoop(7000, running);
  const line = dark ? '#F4F7F5' : L.abismo;
  const h = size * (330 / 340);
  // Elipse do anel (viewBox 30 40 340 330, centro 200,175, raios 150 x 34).
  const orbit: Orbit = {
    cx: (200 - 30) / 340,
    cy: (175 - 40) / 340,
    rx: 150 / 340,
    ry: 34 / 340,
    tilt: -16,
  };
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (float.value - 0.5) * size * 0.05 }],
  }));
  const eyes = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const vb = '30 40 340 330';
  const layer = { position: 'absolute' as const, top: 0, left: 0 };
  return (
    <View
      style={[{ width: size, height: h }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={h} viewBox={vb} style={layer}>
        <G rotation={-16} origin="200, 175">
          <Path
            d="M 50 175 A 150 34 0 0 1 350 175"
            fill="none"
            stroke={line}
            strokeWidth={7}
            strokeLinecap="round"
            opacity={0.45}
          />
        </G>
      </Svg>
      <Satellite
        orbit={orbit}
        size={size}
        t={orbitT}
        phase={0.12}
        dot={size * 0.085}
        color={colors.coral}
        ring={line}
        layer="back"
      />
      <Animated.View style={[{ position: 'absolute', width: size, height: h }, floatStyle]}>
        <Svg width={size} height={h} viewBox={vb} style={layer}>
          <Path
            d="M 150 250 C 150 232 172 222 200 222 C 228 222 250 232 250 250 C 250 292 222 322 200 348 C 178 322 150 292 150 250 Z"
            fill={L.teal}
            stroke={line}
            strokeWidth={7}
            strokeLinejoin="round"
          />
          <Circle cx={200} cy={150} r={96} fill={L.vidro} stroke={line} strokeWidth={7} />
          <Circle cx={200} cy={160} r={70} fill="#01604F" />
          <Path
            d="M 186 186 Q 200 195 214 186"
            fill="none"
            stroke="#F4F7F5"
            strokeWidth={6}
            strokeLinecap="round"
          />
          <Path
            d="M 130 120 A 78 78 0 0 1 186 76"
            fill="none"
            stroke={L.branco}
            strokeWidth={11}
            strokeLinecap="round"
          />
        </Svg>
        <Animated.View
          style={[
            layer,
            { width: size, height: h, transformOrigin: ['50%', `${((151 - 40) / 330) * 100}%`, 0] },
            eyes,
          ]}
        >
          <Svg width={size} height={h} viewBox={vb}>
            <Rect x={166} y={132} width={22} height={38} rx={11} fill="#F4F7F5" />
            <Rect x={212} y={132} width={22} height={38} rx={11} fill="#F4F7F5" />
          </Svg>
        </Animated.View>
      </Animated.View>
      <Svg width={size} height={h} viewBox={vb} style={layer}>
        <G rotation={-16} origin="200, 175">
          <Path
            d="M 50 175 A 150 34 0 0 0 350 175"
            fill="none"
            stroke={line}
            strokeWidth={7}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <Satellite
        orbit={orbit}
        size={size}
        t={orbitT}
        phase={0.12}
        dot={size * 0.085}
        color={colors.coral}
        ring={line}
        layer="front"
      />
    </View>
  );
}

/** Símbolo Órbita (cabeça com olhos e anel), para "Ninguém na sua órbita". */
export function OrbitSymbol({
  size,
  paused,
  style,
}: {
  size: number;
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, dark } = useAppTheme();
  const running = useAnimating(paused);
  const orbitT = useLoop(6000, running);
  const blink = useBlink(running);
  const float = useLoop(2600, running, true);
  const head = dark ? L.nevoa : colors.primary;
  const eye = dark ? L.abismo : '#F4F7F5';
  const line = dark ? '#F4F7F5' : L.abismo;
  const orbit: Orbit = { cx: 64 / 128, cy: 70 / 128, rx: 56 / 128, ry: 16 / 128, tilt: -16 };
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (float.value - 0.5) * size * 0.04 }],
  }));
  const eyes = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const layer = { position: 'absolute' as const, top: 0, left: 0 };
  return (
    <View
      style={[{ width: size, height: size }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox="0 0 128 128" style={layer}>
        <G rotation={-16} origin="64, 70">
          <Path
            d="M 8 70 A 56 16 0 0 1 120 70"
            fill="none"
            stroke={line}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={0.5}
          />
        </G>
      </Svg>
      <Satellite
        orbit={orbit}
        size={size}
        t={orbitT}
        phase={0.08}
        dot={size * 0.11}
        color={colors.coral}
        layer="back"
      />
      <Satellite
        orbit={orbit}
        size={size}
        t={orbitT}
        phase={0.58}
        dot={size * 0.085}
        color={L.nevoa}
        ring={line}
        layer="back"
      />
      <Animated.View style={[{ position: 'absolute', width: size, height: size }, floatStyle]}>
        <Svg width={size} height={size} viewBox="0 0 128 128" style={layer}>
          <Circle cx={64} cy={60} r={32} fill={head} />
        </Svg>
        <Animated.View
          style={[
            layer,
            { width: size, height: size, transformOrigin: ['50%', `${(58 / 128) * 100}%`, 0] },
            eyes,
          ]}
        >
          <Svg width={size} height={size} viewBox="0 0 128 128">
            <Rect x={51} y={50} width={9} height={16} rx={4.5} fill={eye} />
            <Rect x={68} y={50} width={9} height={16} rx={4.5} fill={eye} />
          </Svg>
        </Animated.View>
      </Animated.View>
      <Svg width={size} height={size} viewBox="0 0 128 128" style={layer}>
        <G rotation={-16} origin="64, 70">
          <Path
            d="M 8 70 A 56 16 0 0 0 120 70"
            fill="none"
            stroke={line}
            strokeWidth={6}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <Satellite
        orbit={orbit}
        size={size}
        t={orbitT}
        phase={0.08}
        dot={size * 0.11}
        color={colors.coral}
        layer="front"
      />
      <Satellite
        orbit={orbit}
        size={size}
        t={orbitT}
        phase={0.58}
        dot={size * 0.085}
        color={L.nevoa}
        ring={line}
        layer="front"
      />
    </View>
  );
}

// -------------------------------------------------------------------------
// Fitas de névoa (fundo do splash e transições do onboarding).
// -------------------------------------------------------------------------

export function MistRibbons({
  width,
  height,
  paused,
  style,
}: {
  width: number;
  height: number;
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { dark } = useAppTheme();
  const running = useAnimating(paused);
  const drift = useLoop(16000, running);
  const driftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -(drift.value % 1) * width }] }));
  const slow = useAnimatedStyle(() => ({ transform: [{ translateX: -((drift.value * 0.5) % 1) * width }] }));
  // Uma onda por largura de tela, repetida duas vezes para o laço não ter emenda.
  const wave = (y: number, amp: number) => {
    let d = `M 0 ${y}`;
    for (let i = 0; i < 2; i++) {
      const x = i * width;
      d += ` C ${x + width * 0.25} ${y - amp}, ${x + width * 0.25} ${y + amp}, ${x + width * 0.5} ${y}`;
      d += ` S ${x + width * 0.75} ${y - amp}, ${x + width} ${y}`;
    }
    return `${d} L ${2 * width} ${height} L 0 ${height} Z`;
  };
  const tone = dark ? 0.1 : 0.22;
  return (
    <View style={[{ width, height, overflow: 'hidden' }, style]} pointerEvents="none">
      <Animated.View style={[styles.ribbon, slow]}>
        <Svg width={width * 2} height={height}>
          <Path d={wave(height * 0.55, height * 0.12)} fill={L.nevoa} opacity={tone} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.ribbon, driftStyle]}>
        <Svg width={width * 2} height={height}>
          <Path d={wave(height * 0.72, height * 0.08)} fill={L.jade} opacity={tone * 0.7} />
        </Svg>
      </Animated.View>
    </View>
  );
}

// -------------------------------------------------------------------------
// Estouro de estrelas (RSVP "Vou", todos confirmaram).
// -------------------------------------------------------------------------

function Particle({
  i,
  progress,
  size,
  color,
}: {
  i: number;
  progress: SharedValue<number>;
  size: number;
  color: string;
}) {
  const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const dist = size * 0.9 * p;
    return {
      opacity: p === 0 ? 0 : 1 - p,
      transform: [
        { translateX: Math.cos(angle) * dist },
        { translateY: Math.sin(angle) * dist },
        { scale: 0.4 + (1 - p) * 0.8 },
        { rotate: `${p * 90}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.particle, { marginLeft: -size * 0.18, marginTop: -size * 0.18 }, style]}>
      <StarGlyph size={size * 0.36} color={color} />
    </Animated.View>
  );
}

/** Seis estrelas que estouram do centro quando `trigger` muda. */
export function StarBurst({ trigger, size = 56 }: { trigger: number; size?: number }) {
  const { colors, reduceMotion } = useAppTheme();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!trigger || reduceMotion) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [trigger, reduceMotion, progress]);
  const palette = [colors.primary, colors.coral, colors.mint, colors.bronze, colors.primary, colors.coral];
  return (
    <View pointerEvents="none" style={styles.burst}>
      {palette.map((c, i) => (
        <Particle key={i} i={i} progress={progress} size={size} color={c} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  satellite: { position: 'absolute', top: 0, left: 0 },
  ribbon: { position: 'absolute', top: 0, left: 0 },
  burst: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 },
  particle: { position: 'absolute' },
});
