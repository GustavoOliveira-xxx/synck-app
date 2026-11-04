import { router as original } from 'expo-router';
import { beginNavigation } from '@/stores/navigationLoadingStore';

const transitions = new Set<PropertyKey>(['push', 'navigate', 'replace', 'back']);
/** O Expo inicializa seus métodos após montar a árvore. Consulte sempre a versão atual. */
export const router: typeof original = new Proxy(original, {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (!transitions.has(property) || typeof value !== 'function') return value;
    return (...args: unknown[]) => {
      beginNavigation();
      return Reflect.apply(value, target, args);
    };
  },
});
