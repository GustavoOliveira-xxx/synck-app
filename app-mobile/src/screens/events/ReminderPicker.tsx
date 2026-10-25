import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { notificationsSupported } from '@/services/localNotifications';
import { spacing } from '@/theme/tokens';
import { REMINDER_PRESETS, reminderLabel } from '@/utils/reminders';

/** Escolha de lembretes pessoais (até 5), com opção personalizada. */
export function ReminderPicker({
  value,
  onChange,
  error,
  label,
  hint,
  atTimeLabel,
}: {
  value: number[];
  onChange: (value: number[]) => void;
  error?: string;
  label?: string;
  hint?: string;
  /** Texto da opção "0 minutos" (em tarefas, a hora do prazo em vez da hora do evento). */
  atTimeLabel?: string;
}) {
  const [custom, setCustom] = useState('');
  const toggle = (minutes: number) =>
    onChange(
      value.includes(minutes)
        ? value.filter((m) => m !== minutes)
        : [...value, minutes].sort((a, b) => a - b),
    );
  const customValues = value.filter((m) => !REMINDER_PRESETS.includes(m));

  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label ?? t('events.reminders')}</AppText>
      <AppText variant="small" tone="muted">
        {hint ?? t('events.remindersHint')} {t('reminders.max')}
      </AppText>
      {!notificationsSupported && (
        <AppText variant="small" tone="muted">
          {t('reminders.webNotice')}
        </AppText>
      )}
      <View style={styles.chips}>
        {[...REMINDER_PRESETS, ...customValues].map((m) => (
          <Chip
            key={m}
            label={m === 0 && atTimeLabel ? atTimeLabel : reminderLabel(m)}
            selected={value.includes(m)}
            onPress={() => (value.includes(m) || value.length < 5 ? toggle(m) : undefined)}
          />
        ))}
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label={t('reminders.customMinutes')}
            value={custom}
            onChangeText={(v) => setCustom(v.replace(/\D/g, '').slice(0, 5))}
            keyboardType="number-pad"
          />
        </View>
        <Button
          title={t('reminders.add')}
          variant="secondary"
          compact
          disabled={!custom || value.length >= 5}
          onPress={() => {
            const minutes = Math.min(40320, Number(custom));
            if (!value.includes(minutes)) onChange([...value, minutes].sort((a, b) => a - b));
            setCustom('');
          }}
        />
      </View>
      {error ? (
        <AppText variant="small" tone="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  flex: { flex: 1 },
});
