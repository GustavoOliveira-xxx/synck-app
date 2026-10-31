import { router } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { AuthShell, InlineLink } from '@/components/brand/AuthParts';
import { Button } from '@/components/Button';
import { useFeedback } from '@/components/Feedback';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { requestPasswordReset, resetPasswordWithCode } from '@/services/auth';
import { toFriendlyError } from '@/utils/errors';
import { validateEmail, validateOtp, validatePassword } from '@/validation/auth';

/** Recuperação de senha em 2 passos: e-mail -> código + nova senha. */
export default function ForgotPasswordScreen() {
  const { toast } = useFeedback();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; code?: string; password?: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const e = validateEmail(email);
    setErrors({ email: e });
    if (e) return;
    setLoading(true);
    setMessage(null);
    try {
      await requestPasswordReset(email);
      setStep('code');
    } catch (err) {
      setMessage(toFriendlyError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    const v = { code: validateOtp(code), password: validatePassword(password) };
    setErrors(v);
    if (v.code || v.password) return;
    setLoading(true);
    setMessage(null);
    try {
      await resetPasswordWithCode(email, code, password);
      toast(t('auth.resetDone'));
    } catch (err) {
      setMessage(toFriendlyError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={step === 'email' ? t('auth.forgotTitle') : t('auth.resetTitle')}
      subtitle={step === 'email' ? t('auth.forgotMessage') : t('auth.resetMessage', { email })}
      backTo="/login"
      below={
        step === 'code' ? (
          <InlineLink label={t('auth.resend')} onPress={() => void send()} />
        ) : (
          <InlineLink label={t('auth.backToLogin')} onPress={() => router.replace('/login')} />
        )
      }
    >
      {step === 'email' ? (
        <>
          <TextField
            label={t('auth.email')}
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            onSubmitEditing={send}
          />
          {message ? <AppText tone="danger">{message}</AppText> : null}
          <Button title={t('auth.sendCode')} onPress={send} loading={loading} />
        </>
      ) : (
        <>
          <TextField
            label={t('auth.code')}
            icon="key-outline"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            error={errors.code}
          />
          <TextField
            label={t('auth.newPassword')}
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secure
            hint={t('auth.passwordHint')}
            error={errors.password}
            autoComplete="new-password"
          />
          {message ? <AppText tone="danger">{message}</AppText> : null}
          <Button title={t('common.save')} onPress={reset} loading={loading} />
        </>
      )}
    </AuthShell>
  );
}
