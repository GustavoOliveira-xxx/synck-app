// Formulário com algo digitado: voltar (botão do topo, gesto ou botão do
// Android) pergunta antes de descartar. Depois de salvar, `allowLeave()`
// libera a saída sem perguntar. No navegador, também avisa ao fechar a aba.
import { usePreventRemove } from 'expo-router';
import { useCallback, useRef } from 'react';

import { useFeedback } from '@/components/Feedback';
import { t } from '@/i18n';

export function useUnsavedChanges(dirty: boolean): { allowLeave: () => void } {
  const { confirm } = useFeedback();
  // A liberação chega ao navegador no próximo render; até lá, a saída
  // bloqueada é repetida aqui mesmo, sem pergunta.
  const leaving = useRef(false);
  const disable = usePreventRemove(dirty, ({ repeat }) => {
    if (leaving.current) {
      repeat();
      return;
    }
    void confirm({
      title: t('unsaved.title'),
      message: t('unsaved.message'),
      confirmLabel: t('unsaved.discard'),
      cancelLabel: t('unsaved.keep'),
      destructive: true,
    }).then((ok) => {
      if (ok === true) repeat();
    });
  });
  const allowLeave = useCallback(() => {
    leaving.current = true;
    disable();
  }, [disable]);
  return { allowLeave };
}
