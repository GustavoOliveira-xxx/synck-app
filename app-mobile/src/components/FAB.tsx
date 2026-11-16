import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useScreenFocus } from '@/hooks/useScreenFocus';
import { useAppTheme } from '@/theme/ThemeProvider';
import { elevation, motion } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { PressableScale, tapFeedback } from './motion';

/** Intervalo da respiração do botão parado (ms). */
const BREATH_EVERY = 6000;

/**
 * Botão flutuante 58 dp, raio 20. Entra quicando, o "+" gira 45° ao tocar e,
 * parado, o botão respira de vez em quando para lembrar que está ali (só com
 * a tela em foco e fora do modo leve).
 */
export function FAB({
  icon = 'add',
  label,
  onPress,
}: {
  icon?: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors, reduceMotion, lite } = useAppTheme();
  const focused = useScreenFocus();
  const turn = useSharedValue(0);
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  const breath = useSharedValue(0);
  useEffect(() => {
    enter.value = withSpring(1, motion.molaEntrada);
  }, [enter]);
  useEffect(() => {
    if (lite || !focused) return;
    const timer = setInterval(() => {
      breath.value = withSequence(withTiming(1, { duration: 180 }), withSpring(0, motion.mola));
    }, BREATH_EVERY);
    return () => clearInterval(timer);
  }, [lite, focused, breath]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 45}deg` }] }));
  const wrapStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 0.6 + 0.4 * enter.value },
      { scaleX: 1 + 0.12 * breath.value },
      { scaleY: 1 - 0.1 * breath.value },
    ],
    opacity: Math.min(enter.value, 1),
  }));
  return (
    <Animated.View style={[styles.wrap, wrapStyle]}>
      <PressableScale
        onPress={() => {
          tapFeedback();
          if (!reduceMotion) {
            turn.value = withSpring(1, motion.mola);
            setTimeout(() => (turn.value = withTiming(0, { duration: 240 })), 420);
          }
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.fab, elevation(3, colors), { backgroundColor: colors.primary }]}
      >
        <Animated.View style={iconStyle}>
          <Icon name={icon} size={28} color={colors.primaryText} strokeWidth={2.2} />
        </Animated.View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 20, bottom: 20 },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
