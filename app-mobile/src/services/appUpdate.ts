// Versão nova publicada com o app aberto (site e app instalado pelo
// navegador). Cada tela do site é um arquivo separado, baixado na primeira vez
// que a tela abre; depois de uma publicação, o app aberto ainda procura os
// arquivos da versão anterior. Quando um deles falta, recarregar a página
// traz a versão nova inteira, e a tela abre normalmente.
import { Platform } from 'react-native';

const KEY = 'synck:recarregou-em';
/** Não recarrega de novo se já recarregou há pouco (evita ficar em laço). */
const GUARD_MS = 30_000;

/** O erro é de um pedaço de tela que não pôde ser baixado? */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  const text = `${typeof name === 'string' ? name : ''} ${typeof message === 'string' ? message : ''}`;
  return /AsyncRequireError|Loading module .+ failed|Failed to load split bundle|ChunkLoadError|dynamically imported module|Importing a module script failed/i.test(
    text,
  );
}

/** Pode recarregar agora? (`now` e `last` em ms). */
export function canReload(now: number, last: number | null): boolean {
  return last == null || !Number.isFinite(last) || now - last > GUARD_MS;
}

function lastReload(): number | null {
  try {
    const saved = window.sessionStorage.getItem(KEY);
    return saved ? Number(saved) : null;
  } catch {
    return null;
  }
}

/** Dá para recarregar agora? Só no navegador e se não recarregou há pouco. */
export function shouldReloadForNewVersion(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return canReload(Date.now(), lastReload());
}

/** Recarrega a página para pegar a versão nova (confira antes com shouldReloadForNewVersion). */
export function reloadForNewVersion(): void {
  try {
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Sem armazenamento da sessão: recarrega assim mesmo.
  }
  window.location.reload();
}
