import { forwardRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { useToggleProgress } from './motion';

import { t } from '@/i18n';
import { useAppTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  secure?: boolean;
  /** Ícone à esquerda (ex.: e-mail, cadeado). */
  icon?: IconName;
}

export const TextField = forwardRef<ComponentRef<typeof TextInput>, TextFieldProps>(function TextField(
  { label, error, hint, secure, icon, style, multiline, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const focus = useToggleProgress(focused, 140);
  const focusStyle = useAnimatedStyle(() => ({
    borderColor: error
      ? colors.danger
      : interpolateColor(focus.value, [0, 1], [colors.inputBorder, colors.primary]),
  }));

  return (
    <View style={styles.wrapper}>
      <AppText variant="label" nativeID={`${label}-label`}>
        {label}
      </AppText>
      <Animated.View
        style={[
          styles.inputRow,
          { backgroundColor: colors.surface, borderWidth: 1.5 },
          focusStyle,
          !!icon && { paddingLeft: spacing.md },
          multiline && { alignItems: 'flex-start' },
        ]}
      >
        {icon && <Icon name={icon} size={20} color={error ? colors.danger : colors.textMuted} />}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure && hidden}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            typography.body,
            { color: colors.text },
            multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md },
            style,
          ]}
          {...rest}
        />
        {error && !secure && (
          <View style={styles.trailing}>
            <Icon name="warning-outline" size={20} color={colors.danger} />
          </View>
        )}
        {secure && (
          <IconButton
            icon={hidden ? 'eye-outline' : 'eye-off-outline'}
            label={hidden ? t('auth.showPassword') : t('auth.hidePassword')}
            onPress={() => setHidden((h) => !h)}
            color={colors.textMuted}
          />
        )}
      </Animated.View>
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    minHeight: 52,
  },
  trailing: { paddingRight: spacing.md },
  input: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
