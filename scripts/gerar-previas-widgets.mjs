// Gera as prévias dos widgets (a imagem que o Android mostra na lista de
// widgets antes de a pessoa colocar na tela inicial). Desenha com as mesmas
// cores, fonte e símbolo dos widgets de verdade (src/widgets/SynckWidgets.tsx).
//
// Uso (pasta raiz, depois de "npm ci" em e2e):
//   node scripts/gerar-previas-widgets.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '../e2e/node_modules/playwright-core/index.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(raiz, 'app-mobile');
const saida = join(app, 'assets', 'widgets');
mkdirSync(saida, { recursive: true });

const fonte = (peso) =>
  `url(data:font/ttf;base64,${readFileSync(join(app, 'assets', 'fonts', `TitilliumWeb-${peso}.ttf`)).toString('base64')})`;
const corpoSimbolo = readFileSync(join(app, 'assets', 'brand', 'svg', 'synck-simbolo.svg'), 'utf8')
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '');
const simbolo = (cor) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%"><g fill="${cor}">${corpoSimbolo.replace(/stroke="#000"/g, `stroke="${cor}"`)}</g></svg>`;

const css = `
@font-face { font-family: T; font-weight: 400; src: ${fonte('Regular')}; }
@font-face { font-family: T; font-weight: 600; src: ${fonte('SemiBold')}; }
@font-face { font-family: T; font-weight: 700; src: ${fonte('Bold')}; }
* { box-sizing: border-box; margin: 0; }
body { background: transparent; font-family: T; }
.card { border-radius: 24px; padding: 14px; background: linear-gradient(#FFFFFF, #EEF7F3); color: #0E1A1C;
  box-shadow: 0 6px 18px rgba(3,48,47,.16); display: flex; flex-direction: column; }
.row { display: flex; align-items: center; }
.mark { width: 22px; height: 22px; }
.muted { color: #4A5B5D; }
.b { font-weight: 700; } .s { font-weight: 600; }
`;

const meuDia = `<div class="card" style="width:300px;height:150px">
  <div class="row"><div class="mark">${simbolo('#017A68')}</div>
    <div style="margin-left:8px;flex:1"><div class="b" style="font-size:15px">Meu dia</div>
    <div class="muted" style="font-size:11px">sáb, 31 out · 2 compromissos · 1 tarefa</div></div>
    <div class="row b" style="width:34px;height:34px;border-radius:17px;background:#017A68;color:#fff;justify-content:center;font-size:20px">+</div>
  </div>
  <div style="height:8px"></div>
  ${[
    ['#5E7A16', '07:00', 'Academia', '#01604F'],
    ['#2B6CB0', '20:00', 'Jantar de aniversário', '#01604F'],
    ['#017A68', '○', 'Comprar presente', '#4A5B5D'],
  ]
    .map(
      ([cor, hora, titulo, tom]) => `<div class="row" style="height:26px">
    <div style="width:4px;height:18px;border-radius:2px;background:${cor}"></div>
    <div class="b" style="width:52px;margin-left:8px;font-size:12px;color:${tom}">${hora}</div>
    <div class="s" style="font-size:13px">${titulo}</div></div>`,
    )
    .join('')}
</div>`;

const dias = [];
for (let i = 0; i < 35; i++) dias.push(i - 3);
const mes = `<div class="card" style="width:220px;height:220px">
  <div class="row"><span class="b" style="font-size:16px">Outubro</span><span class="s muted" style="font-size:16px;flex:1">&nbsp;2026</span><div class="mark" style="width:20px;height:20px">${simbolo('#017A68')}</div></div>
  <div class="row" style="margin-top:6px">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((l) => `<div class="b muted" style="flex:1;text-align:center;font-size:10px">${l}</div>`).join('')}</div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);flex:1;align-items:center;justify-items:center">
  ${dias
    .map((n) => {
      const dentro = n >= 1 && n <= 31;
      const hoje = n === 31;
      const ponto = [5, 12, 19, 21, 26, 28, 30].includes(n);
      return `<div style="display:flex;flex-direction:column;align-items:center">
        <div class="${hoje ? 'b' : 's'}" style="width:22px;height:22px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:11px;
        background:${hoje ? '#017A68' : 'transparent'};color:${hoje ? '#fff' : dentro ? '#0E1A1C' : '#A4B3B0'}">${dentro ? n : n < 1 ? 30 + n : n - 31}</div>
        <div style="width:4px;height:4px;border-radius:2px;background:${ponto ? '#FF6F4E' : 'transparent'}"></div></div>`;
    })
    .join('')}
  </div></div>`;

const contagem = `<div class="card" style="width:150px;height:150px;background:linear-gradient(135deg,#2B6CB0,#01604F);color:#fff">
  <div class="row"><div class="b" style="flex:1;font-size:11px;color:#DDF3EE;letter-spacing:1.3px">FALTAM</div><div style="width:18px;height:18px">${simbolo('#FFFFFF')}</div></div>
  <div class="row" style="flex:1;align-items:flex-end"><span class="b" style="font-size:52px;line-height:1">12</span><span class="s" style="font-size:14px;color:#DDF3EE;margin:0 0 8px 4px">dias</span></div>
  <div class="b" style="font-size:14px">Viagem para a praia</div>
  <div style="font-size:11px;color:#DDF3EE">qui, 12 nov · 08:00</div></div>`;

const navegador = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const pagina = await navegador.newPage({ deviceScaleFactor: 2 });
for (const [nome, html, w, h] of [
  ['preview-meu-dia.png', meuDia, 300, 150],
  ['preview-mes.png', mes, 220, 220],
  ['preview-contagem.png', contagem, 150, 150],
]) {
  await pagina.setViewportSize({ width: w + 40, height: h + 40 });
  await pagina.setContent(`<html><head><style>${css}</style></head><body><div style="padding:20px">${html}</div></body></html>`);
  await pagina.evaluate(() => document.fonts.ready);
  writeFileSync(join(saida, nome), await pagina.screenshot({ omitBackground: true }));
  console.log(`app-mobile/assets/widgets/${nome}`);
}
await navegador.close();
