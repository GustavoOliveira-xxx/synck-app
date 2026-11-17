// Regras do movimento elástico e da abertura: quando o modo leve liga, para
// onde o arrasto leva, como o toque achata e o que a abertura diz em cada etapa.
import { confettiParticles, isReturnToTab, openingStage, squash, swipeTarget, tabPath } from '@/utils/motion';

import { marca } from '../marca';
import { isModestDevice } from '../ThemeProvider';

describe('modo leve', () => {
  it('liga em Android com pouca memória', () => {
    expect(isModestDevice('android', 2e9, 2020)).toBe(true);
    expect(isModestDevice('android', 3e9, 2020)).toBe(true);
  });
  it('liga em Android antigo', () => {
    expect(isModestDevice('android', null, 2015)).toBe(true);
  });
  it('fica desligado em aparelhos atuais, no iPhone e no navegador', () => {
    expect(isModestDevice('android', 8e9, 2022)).toBe(false);
    expect(isModestDevice('android', null, null)).toBe(false);
    expect(isModestDevice('ios', 2e9, 2015)).toBe(false);
    expect(isModestDevice('web', null, null)).toBe(false);
  });
});

describe('arrastar entre abas', () => {
  it('vai para a aba vizinha no sentido do dedo', () => {
    expect(swipeTarget(0, 5, -120)).toBe(1);
    expect(swipeTarget(2, 5, 120)).toBe(1);
  });
  it('não sai das pontas', () => {
    expect(swipeTarget(0, 5, 120)).toBeNull();
    expect(swipeTarget(4, 5, -120)).toBeNull();
  });
});

describe('toque elástico', () => {
  it('a altura cede mais que a largura', () => {
    const s = squash(marca.movimento.escalaToque);
    expect(s.x).toBeCloseTo(0.94);
    expect(s.y).toBeCloseTo(0.91);
  });
  it('a volta do toque tem balanço e as molas sem balanço ficam travadas', () => {
    const { mola, molaFirme } = marca.movimento;
    // Amortecimento abaixo do crítico (2 * raiz(k * m)) faz a mola passar do ponto.
    expect(mola.damping).toBeLessThan(2 * Math.sqrt(mola.stiffness * mola.mass));
    expect(molaFirme.overshootClamping).toBe(true);
  });
  it('o confete se espalha em todas as direções', () => {
    expect(confettiParticles(14, 8).some((p) => p.dx > 20)).toBe(true);
    expect(confettiParticles(14, 8).some((p) => p.dx < -20)).toBe(true);
    expect(confettiParticles(14, 8).some((p) => p.dy < -20)).toBe(true);
  });
});

describe('abertura', () => {
  it('diz o que está acontecendo em cada etapa', () => {
    expect(openingStage(0.34)).toBe('Abrindo o SynCK');
    expect(openingStage(0.67)).toBe('Conferindo sua sessão');
    expect(openingStage(1)).toBe('Carregando suas agendas');
  });
});

describe('voltar para uma aba no navegador', () => {
  const tabs = ['index', 'month', 'tasks', 'calendars', 'profile'].map(tabPath);
  it('anima quando volta de uma tela interna para a aba', () => {
    expect(isReturnToTab('/event/123', '/', '/', tabs)).toBe(true);
    expect(isReturnToTab('/task/9', '/tasks', '/tasks', tabs)).toBe(true);
  });
  it('não anima na troca entre abas nem nas outras abas', () => {
    expect(isReturnToTab('/month', '/', '/', tabs)).toBe(false);
    expect(isReturnToTab('/event/123', '/', '/tasks', tabs)).toBe(false);
    expect(isReturnToTab('/', '/', '/', tabs)).toBe(false);
  });
});
