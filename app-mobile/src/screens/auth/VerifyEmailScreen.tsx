import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { AuthShell, InlineLink } from '@/components/brand/AuthParts';
import { Button } from '@/components/Button';
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
    <AuthShell
      title={t('auth.verifyTitle')}
      subtitle={t('auth.verifyMessage', { email: email || '...' })}
      backTo="/login"
      below={<InlineLink label={t('auth.resend')} onPress={() => void resend()} />}
    >
      {!pending && (
        <TextField
          label={t('auth.email')}
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      )}
      <TextField
        label={t('auth.code')}
        icon="key-outline"
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        error={error}
        onSubmitEditing={verify}
      />
      {info ? <AppText tone="success">{info}</AppText> : null}
      <Button title={t('auth.verify')} onPress={verify} loading={loading} />
    </AuthShell>
  );
}
