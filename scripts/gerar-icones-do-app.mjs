// Gera os ícones do app a partir dos SVGs da marca (app-mobile/assets/brand/svg):
// ícone do Android (completo, adaptativo e monocromático), ícone das
// notificações, splash, favicon e os ícones da versão instalável (PWA).
//
// Uso (pasta raiz, depois de "npm ci" em e2e, que traz o navegador usado para desenhar):
//   node scripts/gerar-icones-do-app.mjs
// Se o Chromium não estiver no lugar padrão: CHROMIUM_PATH=/caminho/do/chrome node ...
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '../e2e/node_modules/playwright-core/index.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(raiz, 'app-mobile', 'assets');
const publico = join(raiz, 'app-mobile', 'public', 'icons');
const svg = (nome) => readFileSync(join(assets, 'brand', 'svg', nome), 'utf8');

/** Conteúdo de um SVG (sem a tag externa) e o tamanho do viewBox. */
function partes(texto) {
  const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(texto);
  const corpo = texto.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return { corpo, w: Number(viewBox[1]), h: Number(viewBox[2]) };
}

const personagem = partes(svg('synck-personagem.svg'));
const simbolo = partes(svg('synck-simbolo.svg'));

// O personagem foi vetorizado em 2048 sobre a composição do ícone adaptativo (1024).
const arte = (escala = 1, cx = 512, cy = 448) =>
  `<g transform="translate(${cx} ${cy}) scale(${escala}) translate(-512 -448) scale(${1024 / personagem.w})">${personagem.corpo}</g>`;

/** Fundo do ícone: verde-névoa claro, mais claro no centro (como a arte original). */
const fundo = `<defs><radialGradient id="fundo" cx="50%" cy="42%" r="75%">
  <stop offset="0" stop-color="#FFFFFF"/><stop offset="0.55" stop-color="#E8F6F0"/><stop offset="1" stop-color="#C6ECDF"/>
</radialGradient></defs><rect width="1024" height="1024" fill="url(#fundo)"/>`;

/** Símbolo de uma cor, em branco (notificações e ícone temático). */
const branco = (escala = 1) =>
  `<g transform="translate(512 512) scale(${escala}) translate(-512 -512)" fill="#FFFFFF" stroke="#FFFFFF">${simbolo.corpo
    .replace(/fill="#000"/g, 'fill="#FFFFFF"')
    .replace(/stroke="#000"/g, 'stroke="#FFFFFF"')}</g>`;

const composicoes = {
  // Ícone completo: personagem maior, como na arte original do ícone.
  icone: `${fundo}${arte(1.27, 512, 470)}`,
  // Ícone "maskable" (PWA): mais folga, o sistema recorta em círculo ou gota.
  maskable: `${fundo}${arte(1.05, 512, 490)}`,
  // Adaptativo do Android: só o personagem; a zona segura já está na composição.
  frente: arte(1),
  monocromatico: branco(0.82),
  notificacao: branco(1.02),
  splash: arte(1),
};

const navegador = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const pagina = await navegador.newPage();

async function png(composicao, tamanho) {
  await pagina.setViewportSize({ width: tamanho, height: tamanho });
  await pagina.setContent(
    `<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${tamanho}" height="${tamanho}" style="display:block">${composicao}</svg></body></html>`,
  );
  return pagina.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: tamanho, height: tamanho } });
}

/** .ico com um PNG dentro (aceito por todos os navegadores atuais). */
function ico(pngs) {
  const cabecalho = Buffer.alloc(6 + 16 * pngs.length);
  cabecalho.writeUInt16LE(0, 0);
  cabecalho.writeUInt16LE(1, 2);
  cabecalho.writeUInt16LE(pngs.length, 4);
  let deslocamento = cabecalho.length;
  pngs.forEach(({ tamanho, dados }, i) => {
    const o = 6 + 16 * i;
    cabecalho.writeUInt8(tamanho >= 256 ? 0 : tamanho, o);
    cabecalho.writeUInt8(tamanho >= 256 ? 0 : tamanho, o + 1);
    cabecalho.writeUInt16LE(1, o + 4);
    cabecalho.writeUInt16LE(32, o + 6);
    cabecalho.writeUInt32LE(dados.length, o + 8);
    cabecalho.writeUInt32LE(deslocamento, o + 12);
    deslocamento += dados.length;
  });
  return Buffer.concat([cabecalho, ...pngs.map((p) => p.dados)]);
}

const saidas = [
  [join(assets, 'icon.png'), 'icone', 1024],
  [join(assets, 'android-icon-foreground.png'), 'frente', 1024],
  [join(assets, 'android-icon-monochrome.png'), 'monocromatico', 1024],
  [join(assets, 'notification-icon.png'), 'notificacao', 96],
  [join(assets, 'splash-icon.png'), 'splash', 1152],
  [join(assets, 'favicon.png'), 'icone', 48],
  [join(publico, 'icon-192.png'), 'icone', 192],
  [join(publico, 'icon-512.png'), 'icone', 512],
  [join(publico, 'icon-maskable-512.png'), 'maskable', 512],
  [join(publico, 'apple-touch-icon.png'), 'icone', 180],
  [join(publico, 'badge-96.png'), 'notificacao', 96],
];
for (const [arquivo, nome, tamanho] of saidas) {
  writeFileSync(arquivo, await png(composicoes[nome], tamanho));
  console.log(`${tamanho}px  ${arquivo.slice(raiz.length + 1)}`);
}
const favicon = [];
for (const tamanho of [16, 32, 48]) favicon.push({ tamanho, dados: await png(composicoes.icone, tamanho) });
writeFileSync(join(raiz, 'app-mobile', 'public', 'favicon.ico'), ico(favicon));
console.log('16/32/48px  app-mobile/public/favicon.ico');
await navegador.close();

// O símbolo também vai para os widgets do Android, que recebem o SVG como texto.
const corpoSimbolo = simbolo.corpo.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
writeFileSync(
  join(raiz, 'app-mobile', 'src', 'widgets', 'simbolo.ts'),
  `// Gerado por scripts/gerar-icones-do-app.mjs a partir de assets/brand/svg/synck-simbolo.svg.
// Não edite à mão: rode o script de novo.

/** Símbolo SynCK de uma cor, como texto SVG (para os widgets da tela inicial). */
export function simboloSvg(cor: string): string {
  return ${JSON.stringify(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g fill="__COR__">${corpoSimbolo.replace(/stroke="#000"/g, 'stroke="__COR__"')}</g></svg>`,
  )}.replace(/__COR__/g, cor);
}
`,
);
console.log('app-mobile/src/widgets/simbolo.ts');
