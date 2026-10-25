// Microinterações SynCK: tudo que se toca responde com mola; entradas usam
// saída suave. Com "reduzir movimento" ligado, escalas e deslocamentos viram
// um fade curto.
import * as Haptics from 'expo-haptics';
import { forwardRef, useEffect, type ComponentProps, type ComponentRef, type ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';

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
  /** Escala ao tocar: 0,96 em botões, 0,98 em cartões. */
  scaleTo?: number;
  haptic?: boolean;
  children?: ReactNode;
}

/** Área tocável que afunda com mola e volta com leve rebote. */
export const PressableScale = forwardRef<ComponentRef<typeof Pressable>, PressableScaleProps>(
  function PressableScale(
    {
      style,
      scaleTo = motion.escalaToque,
      haptic,
      onPressIn,
      onPressOut,
      onPress,
      disabled,
      children,
      ...rest
    },
    ref,
  ) {
    const { reduceMotion } = useAppTheme();
    const pressed = useSharedValue(0);
    const animated = useAnimatedStyle(() =>
      reduceMotion
        ? { opacity: 1 - pressed.value * 0.25 }
        : { transform: [{ scale: 1 - (1 - scaleTo) * pressed.value }] },
    );
    return (
      <AnimatedPressable
        ref={ref}
        disabled={disabled}
        onPressIn={(e) => {
          pressed.value = reduceMotion
            ? withTiming(1, { duration: 90 })
            : withTiming(1, { duration: 90, easing: EASE_OUT });
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          pressed.value = reduceMotion ? withTiming(0, { duration: 150 }) : withSpring(0, motion.mola);
          onPressOut?.(e);
        }}
        onPress={(e) => {
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

/** Item de lista que entra em cascata (30 ms entre cada, no máximo 8). */
export function EnterItem({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { reduceMotion } = useAppTheme();
  const delay = Math.min(index, 8) * motion.cascata;
  const entering = reduceMotion
    ? FadeIn.duration(150)
    : FadeInDown.duration(240)
        .delay(delay)
        .easing(EASE_OUT)
        .withInitialValues({ transform: [{ translateY: 10 }] });
  return (
    <MotionView entering={entering} enterDelay={delay} style={style}>
      {children}
    </MotionView>
  );
}

type MotionViewProps = ComponentProps<typeof Animated.View> & {
  /** Atraso da entrada no navegador (no celular vale o da própria animação). */
  enterDelay?: number;
};

/**
 * Animated.View com entrada, saída e mudança de layout. No navegador, essas
 * animações do Reanimated podem deixar o elemento com posição absoluta (fora
 * do fluxo), e ele passa a ficar por cima do que vem depois. Lá a entrada vira
 * um esmaecer simples, que não mexe no layout; saída e reposicionamento são
 * imediatos.
 */
export function MotionView({ entering, exiting, layout, enterDelay = 0, ...rest }: MotionViewProps) {
  if (Platform.OS !== 'web') {
    return <Animated.View entering={entering} exiting={exiting} layout={layout} {...rest} />;
  }
  return <WebFadeIn animate={!!entering} delay={enterDelay} {...rest} />;
}

function WebFadeIn({
  animate,
  delay,
  style,
  ...rest
}: ComponentProps<typeof Animated.View> & { animate: boolean; delay: number }) {
  const { reduceMotion } = useAppTheme();
  const progress = useSharedValue(animate && !reduceMotion ? 0 : 1);
  useEffect(() => {
    if (progress.get() < 1)
      progress.set(withDelay(delay, withTiming(1, { duration: 220, easing: EASE_OUT })));
  }, [progress, delay]);
  const fade = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * 8 }],
  }));
  return <Animated.View style={[style, fade]} {...rest} />;
}

/** Valor 0 → 1 que acompanha `on` com mola (chips, alternadores, check). */
export function useToggleProgress(on: boolean, duration = 160) {
  const { reduceMotion } = useAppTheme();
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    v.value = reduceMotion
      ? withTiming(on ? 1 : 0, { duration: 150 })
      : withTiming(on ? 1 : 0, { duration, easing: EASE_OUT });
  }, [on, reduceMotion, duration, v]);
  return v;
}
