import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { resendSignupCode, verifySignupCode } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';
import { toFriendlyError } from '@/utils/errors';
import { validateEmail, validateOtp } from '@/validation/auth';

/** Confirmação de e-mail por código de 6 dígitos (quando ativada no Supabase). */
export default function VerifyEmailScreen() {
  const pending = useAuthStore((s) => s.pendingEmail);
  const [email, setEmail] = useState(pending ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    const e = validateEmail(email) ?? validateOtp(code);
    setError(e);
    if (e) return;
    setLoading(true);
    try {
      await verifySignupCode(email, code);
      useAuthStore.getState().setPendingEmail(null);
    } catch (err) {
      setError(toFriendlyError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(undefined);
    try {
      await resendSignupCode(email);
      setInfo(t('auth.resent'));
    } catch (err) {
      setError(toFriendlyError(err).message);
    }
  };

  return (
    <Screen showOfflineBanner={false}>
      <AppText>{t('auth.verifyMessage', { email: email || '...' })}</AppText>
      {!pending && (
        <TextField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      )}
      <TextField
        label={t('auth.code')}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        error={error}
      />
      {info ? <AppText tone="success">{info}</AppText> : null}
      <Button title={t('auth.verify')} onPress={verify} loading={loading} />
      <Button title={t('auth.resend')} variant="ghost" onPress={resend} />
    </Screen>
  );
}
