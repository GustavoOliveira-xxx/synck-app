import { decidirVinheta, diaLocal } from '../regra';

describe('vinheta de abertura da CK', () => {
  it('toca completa na primeira abertura do dia', () => {
    expect(decidirVinheta({ ultimoDia: null, hoje: '2026-10-31', reduzirMovimento: false })).toBe('completa');
    expect(decidirVinheta({ ultimoDia: '2026-10-30', hoje: '2026-10-31', reduzirMovimento: false })).toBe(
      'completa',
    );
  });

  it('toca curta nas outras aberturas do mesmo dia', () => {
    expect(decidirVinheta({ ultimoDia: '2026-10-31', hoje: '2026-10-31', reduzirMovimento: false })).toBe(
      'curta',
    );
  });

  it('respeita reduzir movimento', () => {
    expect(decidirVinheta({ ultimoDia: null, hoje: '2026-10-31', reduzirMovimento: true })).toBe('reduzida');
  });

  it('usa o mesmo formato de data da web', () => {
    expect(diaLocal(new Date(2026, 0, 5))).toBe('2026-1-5');
  });
});
