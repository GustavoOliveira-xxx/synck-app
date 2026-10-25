import { Stack } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { changePassword } from '@/services/auth';
import { goBack } from '@/services/navigation';
import { useAuthStore } from '@/stores/authStore';
import { validatePassword } from '@/validation/auth';

export default function ChangePasswordScreen() {
  const email = useAuthStore((s) => s.session?.user.email ?? '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmValue, setConfirmValue] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const { run, busy } = useAction();

  const save = async () => {
    const v = {
      current: current ? undefined : t('validation.required'),
      next: validatePassword(next),
      confirm: next !== confirmValue ? t('validation.passwordMismatch') : undefined,
    };
    setErrors(v);
    if (v.current || v.next || v.confirm) return;
    const result = await run(() => changePassword(email, current, next), { success: t('password.changed') });
    if (result.ok) goBack();
  };

  return (
    <Screen footer={<Button title={t('common.save')} onPress={save} loading={busy} />}>
      <Stack.Screen options={{ title: t('password.title') }} />
      <TextField
        label={t('password.current')}
        value={current}
        onChangeText={setCurrent}
        secure
        error={errors.current}
        autoComplete="current-password"
      />
      <TextField
        label={t('password.new')}
        value={next}
        onChangeText={setNext}
        secure
        hint={t('auth.passwordHint')}
        error={errors.next}
        autoComplete="new-password"
      />
      <TextField
        label={t('password.confirm')}
        value={confirmValue}
        onChangeText={setConfirmValue}
        secure
        error={errors.confirm}
        autoComplete="new-password"
      />
    </Screen>
  );
}
