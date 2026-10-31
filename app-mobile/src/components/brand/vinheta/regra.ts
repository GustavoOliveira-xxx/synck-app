// Quando a vinheta de abertura da CK toca, igual nos apps web:
// completa na primeira abertura do dia, curta nas outras aberturas do dia.
// Com "reduzir movimento" ligado, só a marca aparecendo, sem deslocamento.

export type TipoVinheta = 'completa' | 'curta' | 'reduzida';

export const CHAVE_DIA_VINHETA = 'ck:vinheta:dia';

/** Data local no formato usado pela web (ano-mês-dia, sem zeros à esquerda). */
export function diaLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function decidirVinheta(opcoes: {
  ultimoDia: string | null;
  hoje: string;
  reduzirMovimento: boolean;
}): TipoVinheta {
  if (opcoes.reduzirMovimento) return 'reduzida';
  return opcoes.ultimoDia === opcoes.hoje ? 'curta' : 'completa';
}
