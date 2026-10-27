import { PressableScale } from '@/components/motion';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import type { DateFormat, DateKey, TimeFormat } from '@/models/types';
import { useAppTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { dateKeyParts, formatClock, formatDateKey, makeDateKey } from '@/utils/dates';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';
import { WebDateTimeInput } from './WebDateTimeInput';

type Props = {
  label: string;
  error?: string;
} & (
  | { mode: 'date'; value: DateKey; onChange: (value: DateKey) => void; dateFormat?: DateFormat }
  | { mode: 'time'; value: string; onChange: (value: string) => void; timeFormat?: TimeFormat }
);

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Campo de data ou hora com o seletor nativo do celular.
 * O valor é "relógio de parede" (data AAAA-MM-DD ou hora HH:mm), sem fuso:
 * o fuso do evento é aplicado depois, na conversão para o servidor.
 */
export function DateTimeField(props: Props) {
  const { colors, dark, reduceMotion } = useAppTheme();
  const [iosOpen, setIosOpen] = useState(false);

  const asDate = (): Date => {
    if (props.mode === 'date') {
      const { year, month, day } = dateKeyParts(props.value);
      return new Date(year, month - 1, day, 12, 0);
    }
    const [h, m] = props.value.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const emit = (date: Date) => {
    if (props.mode === 'date')
      props.onChange(makeDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate()));
    else props.onChange(`${pad(date.getHours())}:${pad(date.getMinutes())}`);
  };

  const display =
    props.mode === 'date'
      ? formatDateKey(props.value, props.dateFormat)
      : (() => {
          const [h, m] = props.value.split(':').map(Number);
          return formatClock(h, m, props.timeFormat);
        })();

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: asDate(),
        mode: props.mode,
        is24Hour: props.mode === 'time' ? props.timeFormat !== '12h' : undefined,
        onValueChange: (_event, date) => emit(date),
      });
    } else {
      setIosOpen(true);
    }
  };

  if (Platform.OS === 'web') {
    // Navegador (iPhone, computador): o seletor de data/hora do próprio navegador.
    return (
      <View style={styles.wrapper}>
        <AppText variant="label">{props.label}</AppText>
        <WebDateTimeInput
          mode={props.mode}
          value={props.value}
          onChange={props.onChange as (v: string) => void}
          label={props.label}
          dark={dark}
          colors={{
            text: colors.text,
            surface: colors.surface,
            border: props.error ? colors.danger : colors.inputBorder,
          }}
        />
        {props.error ? (
          <AppText variant="small" tone="danger" accessibilityLiveRegion="polite">
            {props.error}
          </AppText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{props.label}</AppText>
      <PressableScale
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${props.label}: ${display}`}
        style={[
          styles.field,
          { borderColor: props.error ? colors.danger : colors.inputBorder, backgroundColor: colors.surface },
        ]}
      >
        <Icon
          name={props.mode === 'date' ? 'calendar-outline' : 'time-outline'}
          size={20}
          color={colors.textMuted}
        />
        <AppText>{display}</AppText>
      </PressableScale>
      {props.error ? (
        <AppText variant="small" tone="danger" accessibilityLiveRegion="polite">
          {props.error}
        </AppText>
      ) : null}
      {Platform.OS === 'ios' && (
        <Modal
          visible={iosOpen}
          transparent
          animationType={reduceMotion ? 'none' : 'fade'}
          onRequestClose={() => setIosOpen(false)}
        >
          <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
            <View style={[styles.iosSheet, { backgroundColor: colors.surface }]}>
              <DateTimePicker
                value={asDate()}
                mode={props.mode}
                display="spinner"
                onValueChange={(_e, d) => emit(d)}
              />
              <Button title={t('common.done')} onPress={() => setIosOpen(false)} />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs, flex: 1 },
  field: {
    minHeight: MIN_TOUCH,
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  iosSheet: {
    padding: spacing.lg,
    gap: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
});
