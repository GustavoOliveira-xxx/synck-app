// Botão "Entrar com Google". A marca do Google segue as cores oficiais dele
// (é a única exceção às cores SynCK, exigida pelas regras de uso do Google).
import { useState } from 'react';
import { SvgArtwork } from '../Icon';

import { t } from '@/i18n';
import { isGoogleEnabled, signInWithGoogle } from '@/services/auth';
import { toFriendlyError } from '@/utils/errors';

import { Button } from '../Button';

/** Marca preservada nas cores oficiais; original vetorial em assets/icons/google.svg. */
export function GoogleMark({ size = 20 }: { size?: number }) {
  return <SvgArtwork name="google" size={size} color="#4285F4" />;
}

/** Entra (ou cria a conta) com o Google; erros voltam em `onError`. */
export function GoogleButton({
  title = t('auth.google'),
  onError,
}: {
  title?: string;
  onError: (message: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const press = async () => {
    onError(null);
    setLoading(true);
    try {
      if (!(await isGoogleEnabled())) {
        onError(t('auth.googleUnavailable'));
        return;
      }
      const result = await signInWithGoogle();
      if (result === 'cancelled') onError(t('auth.googleCancelled'));
    } catch (error) {
      onError(toFriendlyError(error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button
      title={title}
      variant="secondary"
      leading={<GoogleMark />}
      loading={loading}
      onPress={() => void press()}
      testID="google-signin"
    />
  );
}
