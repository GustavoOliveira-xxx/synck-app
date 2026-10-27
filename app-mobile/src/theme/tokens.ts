// Sistema de design SynCK: cores, espaçamentos, raios, tipografia, sombras e
// movimento. Os valores de marca ficam em marca.ts; aqui eles viram estilos.
// Contraste dos textos principais acima de 4,5:1 nos dois temas (WCAG AA).
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import { CORES_DE_AGENDA, marca, type CoresDoTema, type PesoDaFonte } from './marca';

export type Palette = CoresDoTema;

export const lightPalette: Palette = marca.cores.claro;

export const darkPalette: Palette = marca.cores.escuro;

/** Cores para agendas e eventos, com nome (para não depender só da cor). */
export const CALENDAR_COLORS: { value: string; name: string }[] = CORES_DE_AGENDA.map((c) => ({
  value: c.claro,
  name: c.nome,
}));

/**
 * Cores da paleta antiga (versões 1.x) e a cor SynCK equivalente. Agendas,
 * eventos e avatares criados antes continuam com a cor gravada no banco; a
 * troca acontece só na hora de mostrar.
 */
const CORES_ANTIGAS: Record<string, string> = {
  '#3358d4': '#2B6CB0',
  '#e5484d': '#D9472A',
  '#30a46c': '#5E7A16',
  '#f76b15': '#A86F00',
  '#8e4ec6': '#7E46BF',
  '#0090ff': '#2B6CB0',
  '#d6409f': '#B83A66',
  '#12a594': '#017A68',
  '#ad7f58': '#A86F00',
  '#5b5bd6': '#7E46BF',
  '#8b8d98': '#55707A',
};

/** Cor da agenda para mostrar no tema atual (a versão clara ou a escura). */
export function agendaColor(value: string | null | undefined, dark: boolean): string | undefined {
  if (!value) return undefined;
  const v = CORES_ANTIGAS[value.toLowerCase()] ?? value;
  const known = CORES_DE_AGENDA.find((c) => c.claro.toLowerCase() === v.toLowerCase());
  if (known) return dark ? known.escuro : known.claro;
  return v;
}

export function colorName(value: string | null | undefined): string {
  const v = value ? (CORES_ANTIGAS[value.toLowerCase()] ?? value) : '';
  return CALENDAR_COLORS.find((c) => c.value.toLowerCase() === v.toLowerCase())?.name ?? 'Personalizada';
}

/** Base 4: 4, 8, 12, 16, 20, 24, 32, 40. Margem lateral das telas: 20. */
export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 } as const;

/** Margem lateral padrão das telas. */
export const SCREEN_MARGIN = spacing.xl;

export const radius = {
  xs: marca.cantos.xs,
  /** Campos. */
  sm: marca.cantos.campo,
  /** Cartões. */
  md: marca.cantos.cartao,
  /** FAB e blocos. */
  lg: marca.cantos.bloco,
  /** Topo das folhas inferiores. */
  xl: marca.cantos.folha,
  /** Botões, chips e avatares. */
  pill: 999,
} as const;

/** Área mínima de toque recomendada (48 dp no Android). */
export const MIN_TOUCH = 48;

/** Estilo de fonte para um peso: cada peso tem o seu arquivo. */
export function fonte(peso: PesoDaFonte): { fontFamily: string } {
  return { fontFamily: marca.fonte.familias[peso] };
}

const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const typography = {
  /** 30/34, Titillium Web 700: títulos de destaque (login, onboarding). */
  display: { fontSize: 30, lineHeight: 34, letterSpacing: -0.3, ...fonte('tituloForte') },
  /** 24/30, Titillium Web 700: título de tela. */
  title: { fontSize: 24, lineHeight: 30, letterSpacing: 0, ...fonte('titulo') },
  /** 18/24, Titillium Web 600. */
  heading: { fontSize: 18, lineHeight: 24, ...fonte('semi') },
  /** 16/24. */
  body: { fontSize: 16, lineHeight: 24, ...fonte('regular') },
  /** 15/22. */
  bodyMd: { fontSize: 15, lineHeight: 22, ...fonte('regular') },
  /** 15/20, título de evento. */
  eventTitle: { fontSize: 15, lineHeight: 20, ...fonte('negrito') },
  /** 14/20: textos auxiliares. */
  small: { fontSize: 14, lineHeight: 20, ...fonte('regular') },
  /** 13/18, rótulos. */
  label: { fontSize: 13, lineHeight: 18, ...fonte('semi') },
  /** 12/16, metadados. */
  caption: { fontSize: 12, lineHeight: 16, ...fonte('medio') },
  /** 11/14, caixa alta. */
  overline: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    ...fonte('negrito'),
  },
  /** 13/16, horários com algarismos tabulares. */
  time: { fontSize: 13, lineHeight: 16, ...fonte('negrito'), ...tabular },
} satisfies Record<string, TextStyle>;

/** Sombras curtas tingidas de abismo. No escuro, a profundidade vem da superfície. */
export function elevation(level: 1 | 2 | 3, colors: Palette): ViewStyle {
  const spec = {
    1: { opacity: 0.06, radius: 6, y: 2, android: 1 },
    2: { opacity: 0.1, radius: 14, y: 6, android: 4 },
    3: { opacity: 0.16, radius: 24, y: 12, android: 10 },
  }[level];
  return Platform.select<ViewStyle>({
    android: { elevation: spec.android, shadowColor: colors.shadow },
    default: {
      shadowColor: colors.shadow,
      shadowOpacity: spec.opacity,
      shadowRadius: spec.radius,
      shadowOffset: { width: 0, height: spec.y },
    },
  });
}

export const motion = marca.movimento;

/** Luminância relativa (WCAG). */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 1;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Mistura duas cores hex (t = 0 dá a primeira, 1 dá a segunda). */
export function mix(a: string, b: string, t: number): string {
  const pa = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(a);
  const pb = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(b);
  if (!pa || !pb) return a;
  const out = [1, 2, 3].map((i) => {
    const v = Math.round(parseInt(pa[i], 16) * (1 - t) + parseInt(pb[i], 16) * t);
    return v.toString(16).padStart(2, '0');
  });
  return `#${out.join('')}`.toUpperCase();
}

/** Fundo pastel de avatares e ícones de agenda (texto em `ink` por cima). */
export function pastel(hex: string): string {
  return mix(hex, '#FFFFFF', 0.74);
}

const INK = marca.cores.claro.text;

/** Cor de texto legível sobre um fundo colorido (branco ou `ink`). */
export function readableTextOn(hex: string): string {
  const l = luminance(hex);
  const withWhite = 1.05 / (l + 0.05);
  const withDark = (l + 0.05) / (luminance(INK) + 0.05);
  return withDark > withWhite ? INK : '#FFFFFF';
}
