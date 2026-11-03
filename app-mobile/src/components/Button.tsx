import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte, MIN_TOUCH, radius, spacing } from '@/theme/tokens';

import { SyncLoader } from './SyncLoader';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './motion';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  /** Principal (um por tela), contornado, tonal, perigo ou fantasma. */
  variant?: 'primary' | 'secondary' | 'tonal' | 'danger' | 'ghost';
  icon?: IconName;
  /** Elemento no lugar do ícone (ex.: marca do Google). */
  leading?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  compact?: boolean;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  leading,
  loading,
  disabled,
  accessibilityHint,
  compact,
  testID,
}: ButtonProps) {
  const { colors } = useAppTheme();
  const inactive = disabled || loading;
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
    secondary: { bg: 'transparent', fg: colors.text, border: colors.inputBorder },
    tonal: { bg: colors.primarySoft, fg: colors.primaryInk, border: colors.primarySoft },
    danger: { bg: colors.danger, fg: colors.dangerText, border: colors.danger },
    ghost: { bg: 'transparent', fg: colors.primaryInk, border: 'transparent' },
  }[variant];

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      haptic={variant === 'primary'}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      android_ripple={{ color: `${colors.primary}1F`, borderless: false }}
      style={[
        styles.base,
        compact && styles.compact,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: inactive ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <SyncLoader color={palette.fg} />
        ) : (
          (leading ?? (icon && <Icon name={icon} size={20} color={palette.fg} />))
        )}
        <AppText style={[styles.label, { color: palette.fg }]} numberOfLines={2}>
          {title}
        </AppText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  compact: { alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  label: { fontSize: 16, lineHeight: 22, textAlign: 'center', ...fonte('negrito') },
});
