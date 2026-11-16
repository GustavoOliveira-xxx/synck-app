// Regras puras do movimento elástico e da abertura (sem animação aqui, para
// poderem ser testadas e reaproveitadas pelos componentes).
import { t } from '@/i18n';

/** Achatamento do toque: a altura cede um pouco mais que a largura. */
export function squash(scaleTo: number): { x: number; y: number } {
  return { x: scaleTo, y: 1 - (1 - scaleTo) * 1.5 };
}

/** Aba para onde o arrasto leva, ou null se não há aba para aquele lado. */
export function swipeTarget(index: number, count: number, dx: number): number | null {
  const next = index + (dx < 0 ? 1 : -1);
  return next < 0 || next >= count ? null : next;
}

/** Frase embaixo da esfera da abertura, conforme a etapa. */
export function openingStage(progress: number): string {
  if (progress < 0.5) return t('common.opening');
  if (progress < 0.9) return t('common.openingSession');
  return t('common.openingData');
}

/** Direção, distância e giro de cada partícula do confete (fixos, para não sortear a cada quadro). */
export function confettiParticles(count: number, colors: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 2 ? 0.25 : -0.1);
    const distance = 34 + ((i * 37) % 30);
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance - 14,
      spin: (i % 2 ? 1 : -1) * (180 + i * 25),
      round: i % 3 === 0,
      color: i % colors,
    };
  });
}
