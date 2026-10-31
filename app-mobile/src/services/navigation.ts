// Voltar para a tela anterior. No navegador, uma tela aberta direto pelo
// endereço (link, recarregar a página, ícone da tela de início) não tem tela
// anterior: nesse caso o app sobe para a tela "mãe" (a que normalmente leva
// até ela), em vez de jogar a pessoa sempre na tela Hoje.
import { router, type Href } from 'expo-router';

/** Endereço atual, atualizado pelo layout do app (usePathname). */
let currentPath = '/';

export function setCurrentPath(pathname: string): void {
  currentPath = pathname;
}

/**
 * Tela mãe de um endereço: detalhes voltam para a lista de onde vieram,
 * edição volta para o detalhe e as telas de conta voltam para o Perfil.
 */
export function parentRoute(pathname: string): Href {
  const parts = pathname.split('?')[0].split('/').filter(Boolean);
  const [first, id, sub] = parts;
  switch (first) {
    case 'calendar':
      if (!id || id === 'new') return '/calendars';
      if (sub === 'member') return `/calendar/${id}/members` as Href;
      if (sub) return `/calendar/${id}` as Href;
      return '/calendars';
    case 'event':
      if (id && id !== 'new' && sub) return `/event/${id}` as Href;
      return '/month';
    case 'task':
      if (id && id !== 'new' && sub) return `/task/${id}` as Href;
      return '/tasks';
    case 'list':
    case 'task-filters':
      return '/tasks';
    case 'filters':
      return '/month';
    // Anotações, hábitos e o planejador são abertos pela aba Tarefas.
    case 'notes':
      return id ? '/notes' : '/tasks';
    case 'habits':
      return id ? '/habits' : '/tasks';
    case 'planner':
      return '/tasks';
    case 'sync':
      return id ? '/sync' : '/profile';
    case 'settings':
    case 'diagnostics':
    case 'help':
    case 'privacy':
      return '/profile';
    case 'invites':
      return '/calendars';
    default:
      return '/';
  }
}

/** Endereço a partir do nome da rota e dos parâmetros (ex.: calendar/[id] + {id} → /calendar/abc). */
export function pathFromRoute(name: string, params?: Record<string, unknown>): string {
  const path = name
    .replace(/\/index$/, '')
    .replace(/\[([^\]]+)\]/g, (_, key: string) => String(params?.[key] ?? ''));
  return `/${path}`;
}

export function goBack(fallback?: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback ?? parentRoute(currentPath));
}
