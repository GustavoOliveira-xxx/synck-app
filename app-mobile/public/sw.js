// Service worker: guarda os arquivos do app no aparelho para que ele abra
// mesmo sem internet (os dados vêm do armazenamento do próprio app).
// Chamadas ao servidor (Supabase) nunca passam por aqui: vão direto para a rede.
const CACHE = 'synck-v3';
const SHELL = new URL('./', self.location).href;

// Na instalação guarda a página e todos os arquivos JavaScript do app
// (lista gerada na publicação em precache.json). Assim o app abre sem internet
// já depois do primeiro acesso, mesmo em telas que ainda não foram abertas.
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.add(SHELL);
      let lista = [];
      try {
        const resposta = await fetch(new URL('precache.json', SHELL), { cache: 'no-cache' });
        if (resposta.ok) lista = await resposta.json();
      } catch {
        // Sem a lista, os arquivos são guardados conforme o app os usa.
      }
      await Promise.allSettled(lista.map((arquivo) => cache.add(new URL(arquivo, SHELL).href)));
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // O cache da versão anterior fica: um app aberto antes da atualização
      // ainda pode pedir as telas dela, e elas não existem mais no servidor.
      // Só caches mais antigos que esse são apagados.
      const chaves = await caches.keys();
      const anteriores = chaves.filter((key) => key.startsWith('synck-') && key !== CACHE);
      const manter = new Set([CACHE, ...anteriores.slice(-1)]);
      for (const key of chaves) if (!manter.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Páginas: tenta a rede (versão mais nova); sem internet, usa a cópia guardada.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.href === SHELL) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(SHELL, copy)));
          }
          return response;
        })
        .catch(() => caches.match(SHELL)),
    );
    return;
  }

  // Arquivos do app (nomes mudam a cada versão): cópia guardada primeiro.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
          }
          return response;
        }),
    ),
  );
});

// ---------------------------------------------------------------------
// Notificações (lembretes e avisos) enviadas pelo servidor do SynCK.
// ---------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'SynCK', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'SynCK', {
        body: data.body || '',
        icon: new URL('icons/icon-192.png', SHELL).href,
        badge: new URL('icons/badge-96.png', SHELL).href,
        tag: data.tag,
        silent: !!data.silent,
        data: { path: data.path || '' },
        actions: [{ action: 'abrir', title: 'Abrir' }],
      }),
      marcarIcone(data.badge),
    ]),
  );
});

// Número no ícone do app (tarefas e lembretes pendentes hoje), mandado pelo
// servidor junto de cada notificação. Zero apaga o número.
async function marcarIcone(numero) {
  if (typeof numero !== 'number' || typeof self.navigator.setAppBadge !== 'function') return;
  try {
    if (numero > 0) await self.navigator.setAppBadge(numero);
    else if (typeof self.navigator.clearAppBadge === 'function') await self.navigator.clearAppBadge();
    else await self.navigator.setAppBadge(0);
  } catch {
    // Sistema sem suporte ou indicadores desligados nos ajustes: nada a fazer.
  }
}

// Ao tocar: volta para o SynCK aberto (se houver) ou abre uma janela nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const alvo = new URL(event.notification.data?.path || '', SHELL).href;
  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const aberta = janelas.find((c) => c.url.startsWith(SHELL));
      if (aberta) {
        await aberta.focus();
        if ('navigate' in aberta) return aberta.navigate(alvo);
        return undefined;
      }
      return self.clients.openWindow(alvo);
    })(),
  );
});
