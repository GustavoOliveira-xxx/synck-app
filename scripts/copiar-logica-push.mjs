// Copia para a função de envio de notificações (supabase/functions/enviar-push)
// a mesma lógica de datas, repetição e lembretes usada pelo app, para que o
// servidor calcule os lembretes exatamente como o celular.
//
// Uso: node scripts/copiar-logica-push.mjs            (copia)
//      node scripts/copiar-logica-push.mjs --verificar (só confere; falha se estiver desatualizado)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origem = join(raiz, 'app-mobile', 'src');
const destino = join(raiz, 'supabase', 'functions', 'enviar-push', 'logica');
const ARQUIVOS = ['utils/dates.ts', 'utils/recurrence.ts', 'utils/reminders.ts', 'i18n/index.ts', 'i18n/pt-BR.ts', 'models/types.ts'];
const LUXON = 'npm:luxon@3.7.2';
/** Do dicionário de textos, só as partes que a função usa (deixa a função menor). */
const SECOES_DE_TEXTO = ['weekdays', 'months', 'recurrence', 'reminders', 'calendarView', 'events'];

function soSecoesUsadas(codigo) {
  const linhas = codigo.split('\n');
  const saida = [];
  let manter = true;
  let dentro = false;
  for (const linha of linhas) {
    const topo = /^  (\w+): /.exec(linha);
    if (topo && !dentro) {
      manter = SECOES_DE_TEXTO.includes(topo[1]);
      dentro = !/,$/.test(linha) || /[{[]$/.test(linha);
      if (/[{[]$/.test(linha) === false) dentro = false;
      if (manter) saida.push(linha);
      continue;
    }
    if (dentro) {
      if (manter) saida.push(linha);
      if (/^  [}\]],?$/.test(linha)) dentro = false;
      continue;
    }
    saida.push(linha);
  }
  return saida.join('\n');
}

/** Ajusta os imports para o Deno: caminho relativo com extensão e luxon do npm. */
function paraDeno(codigo, arquivo) {
  return codigo.replace(/from '([^']+)'/g, (trecho, alvo) => {
    if (alvo === 'luxon') return `from '${LUXON}'`;
    let caminho = null;
    if (alvo.startsWith('@/')) caminho = alvo.slice(2);
    else if (alvo.startsWith('.')) caminho = join(dirname(arquivo), alvo).replaceAll('\\', '/');
    if (caminho === null) throw new Error(`import não suportado em ${arquivo}: ${alvo}`);
    const comExt = ARQUIVOS.find((a) => a === `${caminho}.ts` || a === `${caminho}/index.ts`);
    if (!comExt) throw new Error(`${arquivo} importa ${alvo}, que não está na lista de arquivos copiados`);
    let rel = relative(dirname(arquivo), comExt).replaceAll('\\', '/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return `from '${rel}'`;
  });
}

const verificar = process.argv.includes('--verificar');
const desatualizados = [];
for (const arquivo of ARQUIVOS) {
  const cabecalho = `// Cópia gerada de app-mobile/src/${arquivo} por scripts/copiar-logica-push.mjs. Não edite aqui.\n`;
  let codigo = readFileSync(join(origem, arquivo), 'utf8').replaceAll('\r\n', '\n');
  if (arquivo === 'i18n/pt-BR.ts') codigo = soSecoesUsadas(codigo);
  const conteudo = cabecalho + paraDeno(codigo, arquivo);
  const alvo = join(destino, arquivo);
  if (verificar) {
    if (!existsSync(alvo) || readFileSync(alvo, 'utf8') !== conteudo) desatualizados.push(arquivo);
    continue;
  }
  mkdirSync(dirname(alvo), { recursive: true });
  writeFileSync(alvo, conteudo);
}
if (desatualizados.length) {
  console.error(`Lógica da função enviar-push desatualizada: ${desatualizados.join(', ')}.`);
  console.error('Rode: node scripts/copiar-logica-push.mjs');
  process.exit(1);
}
console.log(verificar ? 'Lógica da função enviar-push em dia.' : 'Lógica copiada para supabase/functions/enviar-push/logica.');
