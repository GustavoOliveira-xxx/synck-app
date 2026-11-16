// Movimento elástico do SynCK: tudo que se toca achata e volta balançando
// como gelatina; tudo que entra cai no lugar quicando. Com "reduzir
// movimento" ligado, escalas e deslocamentos viram um fade curto.
//
// Desempenho: só transformação e opacidade, calculadas na thread de interface
// (Reanimated). Nenhuma mola mexe em largura, altura ou margem.
import * as Haptics from 'expo-haptics';
import { forwardRef, useEffect, type ComponentProps, type ComponentRef, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type EntryAnimationsValues,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';

import { useAppTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';
import { squash } from '@/utils/motion';

export const EASE_OUT = Easing.bezier(...motion.curva);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Vibração leve (só no celular). */
export function tapFeedback(kind: 'light' | 'success' | 'select' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'success')
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else if (kind === 'select') void Haptics.selectionAsync().catch(() => {});
  else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Largura ao tocar: 0,94 em botões, 0,975 em cartões. A altura cede mais. */
  scaleTo?: number;
  translateXTo?: number;
  haptic?: boolean;
  children?: ReactNode;
}

/** Área tocável que achata ao tocar e volta como gelatina (passa do ponto e balança). */
export const PressableScale = forwardRef<ComponentRef<typeof Pressable>, PressableScaleProps>(
  function PressableScale(
    {
      style,
      scaleTo = motion.escalaToque,
      translateXTo = 0,
      haptic,
      onPressIn,
      onPressOut,
      onPress,
      onHoverIn,
      onHoverOut,
      disabled,
      children,
      ...rest
    },
    ref,
  ) {
    const { reduceMotion } = useAppTheme();
    const pressed = useSharedValue(0);
    const hovered = useSharedValue(0);
    const base = StyleSheet.flatten(style) ?? {};
    const baseOpacity = typeof base.opacity === 'number' ? base.opacity : 1;
    const baseTransform = Array.isArray(base.transform) ? base.transform : [];
    const { x: sx, y: sy } = squash(scaleTo);
    useEffect(() => {
      if (disabled) {
        cancelAnimation(pressed);
        cancelAnimation(hovered);
        pressed.set(0);
        hovered.set(0);
      }
    }, [disabled, hovered, pressed]);
    const animated = useAnimatedStyle(() => {
      const p = reduceMotion || disabled ? 0 : pressed.value;
      const shade = Math.min(Math.max(pressed.value, 0), 1);
      return {
        opacity: baseOpacity * (1 - shade * 0.06 - hovered.value * 0.035),
        transform: [
          ...baseTransform,
          { scaleX: 1 - (1 - sx) * p },
          { scaleY: 1 - (1 - sy) * p },
          { translateX: translateXTo * Math.max(p, 0) },
        ],
      };
    });
    return (
      <AnimatedPressable
        ref={ref}
        disabled={disabled}
        onPressIn={(e) => {
          if (!disabled) pressed.set(withTiming(1, { duration: motion.pressionar, easing: EASE_OUT }));
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          pressed.set(reduceMotion ? withTiming(0, { duration: 150 }) : withSpring(0, motion.mola));
          onPressOut?.(e);
        }}
        onHoverIn={(e) => {
          if (!disabled) hovered.set(withTiming(1, { duration: motion.micro }));
          onHoverIn?.(e);
        }}
        onHoverOut={(e) => {
          hovered.set(withTiming(0, { duration: motion.micro }));
          onHoverOut?.(e);
        }}
        onPress={(e) => {
          if (disabled) return;
          if (haptic) tapFeedback();
          onPress?.(e);
        }}
        style={[style, animated]}
        {...rest}
      >
        {children}
      </AnimatedPressable>
    );
  },
);

/** Atraso de quem entra em sequência: cresce até o 8º item e depois para. */
export function cascadeDelay(index: number): number {
  return Math.min(Math.max(index, 0), 8) * motion.cascata;
}

/** Entrada elástica: o bloco cai de `distance` dp, um pouco menor, e quica no lugar. */
export function dropIn(delay: number, distance: number = motion.distancia): EntryExitAnimationFunction {
  const spring = motion.molaEntrada;
  const fade = motion.entrada;
  return (_values: EntryAnimationsValues) => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateY: -distance }, { scale: 0.94 }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, { duration: fade })),
        transform: [
          { translateY: withDelay(delay, withSpring(0, spring)) },
          { scale: withDelay(delay, withSpring(1, spring)) },
        ],
      },
    };
  };
}

/**
 * Bloco que cai no lugar quicando, em cascata pelo `index`. Usado nos itens
 * de lista e, pela Screen, em cada bloco de toda tela que abre.
 */
export function EnterItem({
  index = 0,
  children,
  style,
  distance = motion.distancia,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** De quanto acima o bloco cai ao entrar (dp). */
  distance?: number;
}) {
  const { reduceMotion } = useAppTheme();
  const delay = reduceMotion ? 0 : cascadeDelay(index);
  const entering = reduceMotion ? FadeIn.duration(100) : dropIn(delay, distance);
  return (
    <MotionView entering={entering} enterDelay={delay} enterDistance={distance} style={style}>
      {children}
    </MotionView>
  );
}

type MotionViewProps = ComponentProps<typeof Animated.View> & {
  /** Atraso da entrada no navegador (no celular vale o da própria animação). */
  enterDelay?: number;
  /** Altura da queda na entrada no navegador. */
  enterDistance?: number;
};

/**
 * Animated.View com entrada, saída e mudança de layout. No navegador, essas
 * animações do Reanimated podem deixar o elemento com posição absoluta (fora
 * do fluxo), e ele passa a ficar por cima do que vem depois. Lá a entrada é
 * feita aqui mesmo, só com transformação e opacidade, que não mexem no
 * layout; saída e reposicionamento são imediatos.
 */
export function MotionView({
  entering,
  exiting,
  layout,
  enterDelay = 0,
  enterDistance = motion.distancia,
  ...rest
}: MotionViewProps) {
  if (Platform.OS !== 'web') {
    return <Animated.View entering={entering} exiting={exiting} layout={layout} {...rest} />;
  }
  return <WebDropIn animate={!!entering} delay={enterDelay} distance={enterDistance} {...rest} />;
}

function WebDropIn({
  animate,
  delay,
  distance,
  style,
  ...rest
}: ComponentProps<typeof Animated.View> & { animate: boolean; delay: number; distance: number }) {
  const { reduceMotion } = useAppTheme();
  const progress = useSharedValue(animate && !reduceMotion ? 0 : 1);
  const fade = useSharedValue(animate && !reduceMotion ? 0 : 1);
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress);
      cancelAnimation(fade);
      progress.set(1);
      fade.set(1);
    } else if (progress.get() < 1) {
      progress.set(withDelay(delay, withSpring(1, motion.molaEntrada)));
      fade.set(withDelay(delay, withTiming(1, { duration: motion.entrada })));
    }
    return () => {
      cancelAnimation(progress);
      cancelAnimation(fade);
    };
  }, [progress, fade, delay, reduceMotion]);
  const drop = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: reduceMotion
      ? []
      : [{ translateY: (progress.get() - 1) * distance }, { scale: 0.94 + 0.06 * progress.get() }],
  }));
  return <Animated.View style={[style, drop]} {...rest} />;
}

/** Valor 0 → 1 que acompanha `on` (chips, alternadores, check). Com `bounce`, passa do ponto e volta. */
export function useToggleProgress(on: boolean, duration = 160, bounce = false) {
  const { reduceMotion } = useAppTheme();
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) v.value = on ? 1 : 0;
    else if (bounce) v.value = withSpring(on ? 1 : 0, motion.molaEntrada);
    else v.value = withTiming(on ? 1 : 0, { duration, easing: EASE_OUT });
  }, [on, reduceMotion, duration, bounce, v]);
  return v;
}

/** Gelatina de um disparo: achata, estica e balança (uso: `style={useJelly(contador)}`). */
export function useJelly(trigger: number, amount = 0.18) {
  const { reduceMotion } = useAppTheme();
  const k = useSharedValue(0);
  useEffect(() => {
    if (!trigger || reduceMotion) return;
    k.set(1);
    k.set(withSpring(0, motion.mola));
  }, [trigger, reduceMotion, k]);
  return useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + amount * k.value }, { scaleY: 1 - amount * k.value }],
  }));
}
