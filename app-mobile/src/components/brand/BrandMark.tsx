// Personagem do logo SynCK com vida: flutua devagar, a esfera brilha e um
// halo respira atrás dele. Funciona nos dois temas (o personagem não precisa
// da placa clara do logo completo). Parado fora de foco e com "reduzir
// movimento".
import { useEffect } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useScreenFocus } from '@/hooks/useScreenFocus';
import { useAppTheme } from '@/theme/ThemeProvider';

const PERSONAGEM = require('../../../assets/brand/personagem.png');
const RATIO = 160 / 112;

export function BrandMark({
  size,
  halo = true,
  animated = true,
  entrance = true,
  style,
}: {
  /** Largura do personagem. */
  size: number;
  /** Halo verde atrás do personagem. */
  halo?: boolean;
  /** Flutuar e brilhar. */
  animated?: boolean;
  /** Surgir com mola ao aparecer. */
  entrance?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, reduceMotion } = useAppTheme();
  const focused = useScreenFocus();
  const running = animated && focused && !reduceMotion;
  const float = useSharedValue(0);
  const appear = useSharedValue(entrance && !reduceMotion ? 0 : 1);

  useEffect(() => {
    if (appear.get() < 1) {
      appear.set(withTiming(1, { duration: 520, easing: Easing.bezier(0.2, 0.9, 0.25, 1.15) }));
    }
  }, [appear]);

  useEffect(() => {
    if (!running) {
      cancelAnimation(float);
      float.set(withTiming(0, { duration: 300 }));
      return;
    }
    float.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(float);
  }, [running, float]);

  const height = size / RATIO;
  const body = useAnimatedStyle(() => ({
    opacity: appear.get(),
    transform: [
      { translateY: -float.get() * size * 0.045 + (1 - appear.get()) * size * 0.12 },
      { scale: 0.86 + 0.14 * appear.get() },
    ],
  }));
  const glow = useAnimatedStyle(() => ({
    opacity: appear.get() * (0.35 + 0.3 * float.get()),
    transform: [{ scale: 0.9 + 0.12 * float.get() }],
  }));

  return (
    <View
      style={[{ width: size, height }, styles.root, style]}
      pointerEvents="none"
      accessibilityRole="image"
      accessibilityLabel="SynCK"
    >
      {halo && (
        <Animated.View
          style={[
            styles.halo,
            {
              width: size * 0.78,
              height: size * 0.78,
              borderRadius: size,
              top: height * 0.02,
              backgroundColor: colors.primarySoft,
            },
            glow,
          ]}
        />
      )}
      <Animated.View style={body}>
        <Image source={PERSONAGEM} style={{ width: size, height }} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'flex-start' },
  halo: { position: 'absolute', alignSelf: 'center' },
});
