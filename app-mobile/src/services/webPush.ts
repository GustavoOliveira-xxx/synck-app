// Notificações no navegador (iPhone com o SynCK na Tela de Início, e
// computador). O navegador gera uma inscrição; o servidor guarda e, a cada
// minuto, envia os lembretes e avisos (função enviar-push do Supabase).
import { Platform } from 'react-native';

import { supabase, unwrap } from './supabase';

export type WebPushState = 'unsupported' | 'unavailable' | 'blocked' | 'off' | 'on';

const supported = () =>
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!supported()) return null;
  // O service worker é registrado pelo index.html; espera ficar pronto.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((ok) => {
      timer = setTimeout(() => ok(null), 4000);
    });
    return await Promise.race([navigator.serviceWorker.ready, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Converte a chave pública (base64 de URL) no formato que o navegador pede. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function getWebPushState(): Promise<WebPushState> {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await registration();
  if (!reg) return 'unavailable';
  const sub = await reg.pushManager.getSubscription();
  if (!sub || Notification.permission !== 'granted') return 'off';
  const { data, error } = await supabase.rpc('my_push_subscription_active', { p_endpoint: sub.endpoint });
  if (error) return 'unavailable';
  return data ? 'on' : 'off';
}

export async function enableWebPush(): Promise<WebPushState> {
  if (!supported()) return 'unsupported';
  const permission =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const publicKey = unwrap(await supabase.rpc('web_push_public_key')) as string | null;
  if (!publicKey) return 'unavailable';
  const reg = await registration();
  if (!reg) return 'unavailable';
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    });
  }
  const json = sub.toJSON();
  unwrap(
    await supabase.rpc('register_push_subscription', {
      p_endpoint: sub.endpoint,
      p_p256dh: json.keys?.p256dh ?? '',
      p_auth: json.keys?.auth ?? '',
      p_user_agent: navigator.userAgent.slice(0, 300),
    }),
  );
  return 'on';
}

export async function disableWebPush(): Promise<WebPushState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const { error } = await supabase.rpc('unregister_push_subscription', { p_endpoint: sub.endpoint });
    const removed = await sub.unsubscribe();
    if (error && !removed) throw error;
  }
  return 'off';
}

/** Ao sair da conta neste navegador, para de receber as notificações dela. */
export async function forgetWebPush(): Promise<void> {
  if (!supported()) return;
  await disableWebPush().catch(() => undefined);
}
