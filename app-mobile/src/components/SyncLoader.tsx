import { useEffect } from 'react';
import { AppState } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useScreenFocus } from '@/hooks/useScreenFocus';
import { useAppTheme } from '@/theme/ThemeProvider';

/** Dois arcos se encontram: vetor local, animado na UI nativa, sem vídeo ou rede. */
export function SyncLoader({ size = 24, color }: { size?: number; color?: string }) {
  const { colors, reduceMotion } = useAppTheme();
  const focused = useScreenFocus();
  const progress = useSharedValue(0);
  useEffect(() => {
    const update = (active: boolean) => {
      cancelAnimation(progress);
      progress.set(0);
      if (active && focused && !reduceMotion)
        progress.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1));
    };
    update(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
    const subscription = AppState.addEventListener('change', (state) => update(state === 'active'));
    return () => {
      subscription.remove();
      cancelAnimation(progress);
    };
  }, [progress, reduceMotion, focused]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * 360}deg` }] }));
  return (
    <Animated.View style={[{ width: size, height: size }, style]} accessible={false}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color ?? colors.primary}
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden
      >
        <Path d="M4 12a8 8 0 0 1 13.65-5.65L20 9M20 4v5h-5" />
        <Path d="M20 12A8 8 0 0 1 6.35 17.65L4 15M4 20v-5h5" opacity={0.45} />
      </Svg>
    </Animated.View>
  );
}
