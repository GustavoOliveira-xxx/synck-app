import { PressableScale } from '@/components/motion';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { fonte, MIN_TOUCH, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

/** Linha de lista tocável (menus, configurações, membros...). */
export function ListItem({
  title,
  subtitle,
  icon,
  iconColor,
  left,
  right,
  onPress,
  danger,
  chevron = !!onPress,
  disabled,
  accessibilityHint,
  testID,
}: ListItemProps) {
  const { colors } = useAppTheme();
  const textColor = danger ? colors.danger : colors.text;
  const tint = iconColor ?? (danger ? colors.danger : colors.primaryInk);
  return (
    <PressableScale
      scaleTo={0.99}
      testID={testID}
      onPress={onPress}
      disabled={!onPress || disabled}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      android_ripple={onPress ? { color: colors.surfaceAlt } : undefined}
      style={[styles.row, { backgroundColor: 'transparent', opacity: disabled ? 0.5 : 1 }]}
    >
      {left}
      {icon && (
        <View style={[styles.iconTile, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }]}>
          <Icon name={icon} size={20} color={tint} />
        </View>
      )}
      <View style={styles.texts}>
        <AppText style={{ color: textColor, ...fonte('semi'), fontSize: 15, lineHeight: 20 }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
      {chevron && <Icon name="chevron-forward" size={18} color={colors.textMuted} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
});
