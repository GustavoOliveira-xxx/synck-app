import { PressableScale } from '@/components/motion';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { OptionSheet, type Option } from './OptionSheet';

/** Campo de seleção: mostra o valor atual e abre a lista de opções ao tocar. */
export function SelectField<T>({
  label,
  value,
  options,
  onChange,
  hint,
  searchable,
  searchPlaceholder,
  disabled,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  hint?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label}</AppText>
      <PressableScale
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? ''}`}
        accessibilityHint={hint}
        accessibilityState={{ disabled: !!disabled }}
        style={[
          styles.field,
          { borderColor: colors.inputBorder, backgroundColor: colors.surface, opacity: disabled ? 0.55 : 1 },
        ]}
      >
        <AppText style={styles.flex} numberOfLines={1}>
          {current?.label ?? String(value)}
        </AppText>
        <Icon name="chevron-down" size={18} color={colors.textMuted} />
      </PressableScale>
      {hint ? (
        <AppText variant="small" tone="muted">
          {hint}
        </AppText>
      ) : null}
      <OptionSheet
        visible={open}
        title={label}
        options={options}
        value={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  field: {
    minHeight: MIN_TOUCH,
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: { flex: 1 },
});
