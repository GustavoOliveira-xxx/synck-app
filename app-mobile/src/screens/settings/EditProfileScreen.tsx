import { Stack } from 'expo-router';
import { useState } from 'react';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { ColorPicker } from '@/components/ColorPicker';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAction } from '@/hooks/useAction';
import { saveProfile } from '@/services/account';
import { t } from '@/i18n';
import { goBack } from '@/services/navigation';
import { CALENDAR_COLORS } from '@/theme/tokens';
import { useAuthStore } from '@/stores/authStore';
import { validateDisplayName } from '@/validation/auth';

export default function EditProfileScreen() {
  const account = useAuthStore((s) => s.account);
  const [name, setName] = useState(account?.display_name ?? '');
  const [color, setColor] = useState(account?.avatar_color ?? CALENDAR_COLORS[0].value);
  const [error, setError] = useState<string | undefined>();
  const { run, busy } = useAction();

  const save = async () => {
    const e = validateDisplayName(name);
    setError(e);
    if (e) return;
    const result = await run(() => saveProfile({ display_name: name.trim(), avatar_color: color }), {
      success: t('profile.saved'),
    });
    if (result.ok) goBack();
  };

  return (
    <Screen footer={<Button title={t('common.save')} onPress={save} loading={busy} />}>
      <Stack.Screen options={{ title: t('profile.edit') }} />
      <Avatar name={name || '?'} color={color} size={72} />
      <TextField label={t('profile.name')} value={name} onChangeText={setName} error={error} maxLength={80} />
      <ColorPicker label={t('profile.avatarColor')} value={color} onChange={(c) => c && setColor(c)} />
    </Screen>
  );
}
