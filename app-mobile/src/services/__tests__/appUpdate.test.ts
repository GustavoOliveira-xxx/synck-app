import { canReload, isChunkLoadError } from '../appUpdate';

describe('versão nova com o app aberto', () => {
  it('reconhece tela da versão anterior que não pôde ser baixada', () => {
    const e = Object.assign(
      new Error('Loading module https://site/_expo/static/js/web/routine-abc.js failed.'),
      {
        name: 'AsyncRequireError',
      },
    );
    expect(isChunkLoadError(e)).toBe(true);
    expect(isChunkLoadError(new Error('Failed to load split bundle from URL: x'))).toBe(true);
  });
  it('não confunde com outros erros', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(
      false,
    );
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError('Loading')).toBe(false);
  });
  it('recarrega no máximo uma vez a cada 30 segundos', () => {
    expect(canReload(100_000, null)).toBe(true);
    expect(canReload(100_000, 90_000)).toBe(false);
    expect(canReload(100_000, 60_000)).toBe(true);
  });
});
