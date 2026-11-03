import { StyleSheet } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { elevation, MIN_TOUCH, radius } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './motion';

/** Botão só com ícone. O rótulo é obrigatório para leitores de tela. */
export function IconButton({
  icon,
  label,
  onPress,
  color,
  disabled,
  filled,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  /** Círculo em `surface` com sombra curta (ex.: sino na tela Hoje). */
  filled?: boolean;
  testID?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <PressableScale
      testID={testID}
      translateXTo={icon === 'chevron-back' ? -4 : 0}
      scaleTo={icon === 'chevron-back' ? 0.9 : 0.975}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      style={[
        styles.base,
        filled && [{ backgroundColor: colors.surface }, elevation(1, colors)],
        { opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <Icon name={icon} color={color ?? colors.text} size={24} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
