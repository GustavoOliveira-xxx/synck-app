import { Platform } from 'react-native';
import { enableWebPush, getWebPushState } from '../webPush';
import { supabase } from '../supabase';
jest.mock('../supabase', () => ({ supabase: { rpc: jest.fn() }, unwrap: (r: { data: unknown }) => r.data }));
test('pede permissão no toque e detecta inscrição ausente no servidor', async () => {
  const props = [
    ['window', globalThis],
    [
      'navigator',
      {
        userAgent: 'Teste',
        serviceWorker: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: async () => ({
                endpoint: 'https://push.example/fixture',
                toJSON: () => ({ keys: { p256dh: 'p', auth: 'a' } }),
              }),
            },
          }),
        },
      },
    ],
    ['PushManager', {}],
    ['Notification', { permission: 'default', requestPermission: jest.fn(async () => 'granted') }],
  ] as const;
  const originals = props.map(([k]) => Object.getOwnPropertyDescriptor(globalThis, k));
  const os = Platform.OS;
  try {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    for (const [k, v] of props) Object.defineProperty(globalThis, k, { configurable: true, value: v });
    const rpc = jest.mocked(supabase.rpc);
    rpc.mockImplementation(((name: string) =>
      Promise.resolve({
        data: name === 'web_push_public_key' ? 'AA' : false,
        error: null,
      })) as unknown as typeof supabase.rpc);
    const result = enableWebPush();
    expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
    expect(await result).toBe('on');
    Object.defineProperty(Notification, 'permission', { value: 'granted' });
    expect(await getWebPushState()).toBe('off');
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    props.forEach(([k], i) => {
      if (originals[i]) Object.defineProperty(globalThis, k, originals[i]!);
      else Reflect.deleteProperty(globalThis, k);
    });
  }
});
