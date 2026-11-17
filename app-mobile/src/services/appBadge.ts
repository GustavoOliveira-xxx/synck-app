// Número no ícone do app instalado (iPhone a partir do iOS 16.4, Android e
// computador com o app instalado pelo navegador). O sistema só mostra o
// número se as notificações do SynCK estiverem permitidas; em navegadores
// sem suporte, nada acontece.
import { Platform } from 'react-native';

type BadgeNavigator = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function badgeNavigator(): BadgeNavigator | null {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  const nav = navigator as BadgeNavigator;
  return typeof nav.setAppBadge === 'function' ? nav : null;
}

/** Mostra `count` no ícone; zero apaga o número. */
export async function setAppBadge(count: number): Promise<void> {
  const nav = badgeNavigator();
  if (!nav) return;
  try {
    if (count > 0) await nav.setAppBadge!(count);
    else await (nav.clearAppBadge ? nav.clearAppBadge() : nav.setAppBadge!(0));
  } catch {
    // Permissão negada ou sistema sem suporte: o número só não aparece.
  }
}
