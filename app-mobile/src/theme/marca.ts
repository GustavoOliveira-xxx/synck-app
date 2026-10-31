// Identidade visual SynCK (um produto CK Group).
//
// Fonte única de cores, fontes, cantos, sombras e movimento, copiada do pacote
// de identidade (02-cores-e-tokens/tokens.ts). Telas e componentes leem daqui
// por meio de src/theme/tokens.ts; nenhuma tela usa cor solta.

export interface CoresDoTema {
  /** Fundo das telas (`bg`). */
  background: string;
  /** Cartões, folhas, barra de navegação e campos (`surface`). */
  surface: string;
  /** Áreas afundadas: trilhos, linhas alternadas, fundo de seletor (`surfaceSunken`). */
  surfaceAlt: string;
  /** Linhas e divisórias (`line`). */
  border: string;
  /** Borda de campos e botões contornados (`lineStrong`, 3:1 com o fundo). */
  inputBorder: string;
  /** Texto principal (`ink`). */
  text: string;
  /** Texto secundário e metadados (`inkMuted`). */
  textMuted: string;
  /** Botão principal, FAB, dia selecionado, item ativo. */
  primary: string;
  /** Texto sobre `primary` (`onPrimary`). */
  primaryText: string;
  /** Chip selecionado, botão tonal, pílula ativa. */
  primarySoft: string;
  /** Links e rótulos de marca. */
  primaryInk: string;
  /** Blocos de marca escuros. */
  tide: string;
  /** Realces gráficos e névoa. */
  mint: string;
  /** Sinal pontual: "agora", não lido. */
  coral: string;
  onCoral: string;
  /** Realce dentro do toast (fundo `ink`). */
  accentInverse: string;
  /** Detalhes de marca (filete); `bronzeInk` para texto. */
  bronze: string;
  bronzeInk: string;
  danger: string;
  /** Texto sobre `danger` (`onDanger`). */
  dangerText: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  /** Contorno de foco (teclado e leitores de tela). */
  focus: string;
  /** Escurecimento atrás de folhas e diálogos (`scrim`). */
  overlay: string;
  /** Destaque do dia de hoje no calendário. */
  today: string;
  /** Sombra tingida de abismo. */
  shadow: string;
}

export type PesoDaFonte = 'regular' | 'medio' | 'semi' | 'negrito' | 'titulo' | 'tituloForte';

/** As 8 cores de agenda, com nome. A mesma posição vale nos dois temas. */
export const CORES_DE_AGENDA = [
  { nome: 'Maré', claro: '#017A68', escuro: '#15C9AB' },
  { nome: 'Coral', claro: '#D9472A', escuro: '#FF8A6E' },
  { nome: 'Âmbar', claro: '#A86F00', escuro: '#F5C04A' },
  { nome: 'Céu', claro: '#2B6CB0', escuro: '#7FB6F0' },
  { nome: 'Ameixa', claro: '#7E46BF', escuro: '#C3A0F0' },
  { nome: 'Rosa', claro: '#B83A66', escuro: '#F290B5' },
  { nome: 'Oliva', claro: '#5E7A16', escuro: '#B8D45C' },
  { nome: 'Ardósia', claro: '#55707A', escuro: '#9DB3BC' },
] as const;

/** Cores fixas do logo (não mudam com o tema). */
export const CORES_DO_LOGO = {
  abismo: '#03302F',
  teal: '#01907A',
  jade: '#15C9AB',
  nevoa: '#89E1C4',
  bronze: '#BFAA8C',
  /** Fundo da splash do Android 12+ e do ícone. */
  splash: '#E4F5EF',
  /** Vidro claro do mascote Kairo. */
  vidro: '#C9F1E3',
  /** Brilho do vidro. */
  brilho: '#E9FFF8',
  branco: '#FFFFFF',
} as const;

export const marca = {
  nome: 'SynCK',
  assinatura: 'um produto CK Group',

  cores: {
    claro: {
      background: '#F4F7F5',
      surface: '#FFFFFF',
      surfaceAlt: '#E8EFEC',
      border: '#D5E0DC',
      inputBorder: '#7A908D',
      text: '#0E1A1C',
      textMuted: '#4A5B5D',
      primary: '#017A68',
      primaryText: '#FFFFFF',
      primarySoft: '#DDF3EE',
      primaryInk: '#01604F',
      tide: '#03302F',
      mint: '#89E1C4',
      coral: '#FF6F4E',
      onCoral: '#0E1A1C',
      accentInverse: '#6FE3C6',
      bronze: '#BFAA8C',
      bronzeInk: '#6F5E41',
      danger: '#B3261E',
      dangerText: '#FFFFFF',
      dangerSoft: '#F9E3E1',
      success: '#1B6E8F',
      successSoft: '#DDEFF6',
      warning: '#7A4F00',
      warningSoft: '#FBEBC8',
      focus: '#0E1A1C',
      overlay: 'rgba(3,48,47,0.48)',
      today: '#017A68',
      shadow: '#03302F',
    } satisfies CoresDoTema,
    escuro: {
      background: '#0A1416',
      surface: '#112124',
      surfaceAlt: '#0D1A1C',
      border: '#22383B',
      inputBorder: '#5E7B7D',
      text: '#E8F1EE',
      textMuted: '#9DB3B0',
      primary: '#15C9AB',
      primaryText: '#03302F',
      primarySoft: '#12393A',
      primaryInk: '#89E1C4',
      tide: '#0F4A47',
      mint: '#3DBA9F',
      coral: '#FF8A6E',
      onCoral: '#0E1A1C',
      accentInverse: '#09625C',
      bronze: '#CDB998',
      bronzeInk: '#D9C6A5',
      danger: '#FFB4A9',
      dangerText: '#410E0B',
      dangerSoft: '#3B1D1A',
      success: '#7FD3F0',
      successSoft: '#12313B',
      warning: '#FFC861',
      warningSoft: '#3A2A06',
      focus: '#F4FFFB',
      overlay: 'rgba(0,0,0,0.6)',
      today: '#15C9AB',
      shadow: '#000000',
    } satisfies CoresDoTema,
  },

  fonte: {
    /** Titillium Web local: mesma tipografia em todas as plataformas, inclusive offline. */
    familias: {
      regular: 'TitilliumWeb-Regular',
      medio: 'TitilliumWeb-Regular',
      semi: 'TitilliumWeb-SemiBold',
      negrito: 'TitilliumWeb-Bold',
      titulo: 'TitilliumWeb-Bold',
      tituloForte: 'TitilliumWeb-Bold',
    } as Record<PesoDaFonte, string>,
    arquivos: {
      'TitilliumWeb-Regular': require('../../assets/fonts/TitilliumWeb-Regular.ttf'),
      'TitilliumWeb-SemiBold': require('../../assets/fonts/TitilliumWeb-SemiBold.ttf'),
      'TitilliumWeb-Bold': require('../../assets/fonts/TitilliumWeb-Bold.ttf'),
    } as Record<string, number>,
  },

  /** Raios: campos 10, cartões 14, FAB e blocos 22, topo de folhas 28. */
  cantos: { xs: 6, campo: 10, cartao: 14, bloco: 22, folha: 28 },

  /** Movimento: molas no toque, saída suave nas entradas. */
  movimento: {
    escalaToque: 0.975,
    escalaCartao: 0.99,
    mola: { stiffness: 520, damping: 36, mass: 0.7, overshootClamping: true },
    curva: [0.2, 0.8, 0.2, 1] as const,
    pressionar: 65,
    micro: 120,
    base: 180,
    celebrar: 600,
    /** Intervalo entre itens que entram em sequência. */
    cascata: 45,
    /** Entrada de telas e blocos: tempo e deslocamento. */
    entrada: 420,
    distancia: 18,
    /** Mola das entradas: assenta com um leve balanço. */
    molaEntrada: { stiffness: 210, damping: 22, mass: 0.9 },
  },
};
