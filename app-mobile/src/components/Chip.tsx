import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale, tapFeedback, useToggleProgress } from './motion';

/** Opção selecionável (filtros, dias da semana...). O ✓ entra crescendo quando marcada. */
export function Chip({
  label,
  selected,
  onPress,
  color,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  accessibilityLabel?: string;
}) {
  const { colors } = useAppTheme();
  const progress = useToggleProgress(selected, 160, true);
  const check = useAnimatedStyle(() => ({
    width: 18 * progress.value,
    opacity: progress.value,
    transform: [{ scale: 0.4 + 0.6 * progress.value }],
  }));
  return (
    <PressableScale
      onPress={() => {
        tapFeedback('select');
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected }}
      hitSlop={4}
      style={[
        styles.chip,
        {
          borderColor: selected ? colors.primarySoft : colors.border,
          backgroundColor: selected ? colors.primarySoft : colors.surface,
        },
      ]}
    >
      <Animated.View style={[styles.check, check]}>
        <Icon name="checkmark" size={16} color={colors.primaryInk} />
      </Animated.View>
      {color && <View style={[styles.dot, { backgroundColor: color }]} />}
      <AppText
        variant="label"
        style={{ color: selected ? colors.primaryInk : colors.text, ...fonte(selected ? 'negrito' : 'semi') }}
      >
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  check: { overflow: 'hidden', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
