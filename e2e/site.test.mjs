// Testes da versão instalável (PWA), do jeito que ela fica publicada:
// numa subpasta do site (como no GitHub Pages), com 404.html para links diretos.
//
// Pré-requisito: o site gerado em SITE_DIR (o workflow "Publicar versão web"
// gera em app-mobile/dist-site) e o subcaminho em BASE_PATH (ex.: /synck-app/).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const aqui = dirname(fileURLToPath(import.meta.url));
const SITE = process.env.SITE_DIR ?? join(aqui, '..', 'app-mobile', 'dist-site');
const BASE = (process.env.BASE_PATH ?? '/synck-app/').replace(/\/?$/, '/');
const tipos = {
  '.js': 'text/javascript',
  '.html': 'text/html',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
};

// Sem as Variables do Supabase o site abre em "Servidor não configurado": também vale,
// porque aqui o que se testa é a instalação e o modo offline, não o login.
const TELA_INICIAL = /Sua rotina, sincronizada com quem importa|Servidor não configurado/;
const TELA_LOGIN = /Esqueci a senha|Servidor não configurado/;

let servidor;
let origem;
let navegador;
let ctx;
let page;
const erros = [];

before(async () => {
  assert.ok(existsSync(join(SITE, 'index.html')), `Site não encontrado em ${SITE}`);
  assert.ok(existsSync(join(SITE, '404.html')), 'Falta o 404.html (links diretos no GitHub Pages)');
  // Imita o GitHub Pages: arquivos sob BASE; caminho desconhecido devolve 404.html com status 404.
  servidor = http.createServer((req, res) => {
    const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!caminho.startsWith(BASE)) {
      res.writeHead(404);
      return res.end();
    }
    let arquivo = join(SITE, caminho.slice(BASE.length));
    if (existsSync(arquivo) && statSync(arquivo).isDirectory()) arquivo = join(arquivo, 'index.html');
    if (!existsSync(arquivo)) {
      res.writeHead(404, { 'content-type': 'text/html' });
      return createReadStream(join(SITE, '404.html')).pipe(res);
    }
    res.writeHead(200, { 'content-type': tipos[extname(arquivo)] ?? 'application/octet-stream' });
    createReadStream(arquivo).pipe(res);
  });
  await new Promise((ok) => servidor.listen(0, ok));
  origem = `http://localhost:${servidor.address().port}`;
  navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
  // O servidor real não é necessário aqui: só a casca do app é testada.
  await ctx.route(/supabase\.co/, (r) =>
    r.fulfill({ status: 200, body: '[]', headers: { 'access-control-allow-origin': '*' } }),
  );
  page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(e.message));
});

after(async () => {
  await navegador?.close();
  servidor?.close();
});

test('abre na subpasta do site', async () => {
  await page.goto(origem + BASE);
  await page.getByText(TELA_INICIAL).first().waitFor({ timeout: 20_000 });
  assert.ok(page.url().startsWith(origem + BASE));
});

test('manifesto e ícones para instalar na tela de início', async () => {
  const m = await page.evaluate(async () => {
    const link = document.querySelector('link[rel=manifest]');
    const r = await fetch(link.href);
    const json = await r.json();
    const icones = await Promise.all(json.icons.map(async (i) => (await fetch(new URL(i.src, link.href))).status));
    const apple = document.querySelector('link[rel=apple-touch-icon]');
    return { status: r.status, json, icones, apple: (await fetch(apple.href)).status };
  });
  assert.equal(m.status, 200);
  assert.equal(m.json.display, 'standalone');
  assert.equal(m.json.lang, 'pt-BR');
  assert.deepEqual(m.icones, [200, 200, 200]);
  assert.equal(m.apple, 200, 'ícone do iPhone (apple-touch-icon)');
});

test('service worker ativo no escopo do site', async () => {
  const escopo = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  assert.equal(escopo, origem + BASE);
});

test('instalação guarda todos os arquivos do app (abre sem internet desde o 1º acesso)', async () => {
  const faltando = await page.evaluate(async () => {
    const { scope } = await navigator.serviceWorker.ready;
    const lista = await (await fetch(new URL('precache.json', scope))).json();
    const ausentes = [];
    for (const arquivo of lista) if (!(await caches.match(new URL(arquivo, scope).href))) ausentes.push(arquivo);
    return { total: lista.length, ausentes };
  });
  assert.ok(faltando.total > 0, 'precache.json vazio');
  assert.deepEqual(faltando.ausentes, []);
});

test('link direto para uma tela funciona (404.html)', async () => {
  await page.reload();
  await page.goto(origem + BASE + 'login');
  await page.getByText(TELA_LOGIN).first().waitFor({ timeout: 20_000 });
});

test('sem internet, o app abre mesmo assim', async () => {
  await ctx.setOffline(true);
  await page.goto(origem + BASE);
  await page.getByText(TELA_INICIAL).first().waitFor({ timeout: 20_000 });
  await ctx.setOffline(false);
});

test('Chrome aceita a notificação de push com a aba do aplicativo fechada',async()=>{
  await ctx.grantPermissions(['notifications'],{origin:origem});
  const controle=await ctx.newPage();
  await controle.route(origem+'/fora-do-aplicativo',r=>r.fulfill({status:200,contentType:'text/html',body:'<title>Controle</title>'}));
  await controle.goto(origem+'/fora-do-aplicativo');
  const cdp=await ctx.newCDPSession(controle);
  let registrationId;
  cdp.on('ServiceWorker.workerRegistrationUpdated',({registrations})=>{
    const registration=registrations.find(r=>r.scopeURL===origem+BASE && !r.isDeleted);
    if(registration)registrationId=registration.registrationId;
  });
  await cdp.send('ServiceWorker.enable');
  if(!page.url().startsWith(origem+BASE))await page.goto(origem+BASE);
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  for(let i=0; i<100&&!registrationId;i++)await new Promise(done=>setTimeout(done,100));
  assert.ok(registrationId,'registro do service worker');
  const worker=ctx.serviceWorkers().find(w=>w.url().startsWith(origem+BASE));
  await worker.evaluate(()=>{
    self.probe={};
    self.addEventListener('push',()=>{self.probe.received=true});
    const show=self.registration.showNotification.bind(self.registration);
    self.registration.showNotification=async(title,options)=>{try{await show(title,options);self.probe.shown=[title,options.body,options.data.path,options.silent]}catch(e){self.probe.error=e.message;throw e}};
  });
  await page.close();
  const data={title:'synCK · teste',body:'Evento de demonstração',tag:'teste-local',path:'notifications',silent:true};
  await cdp.send('ServiceWorker.deliverPushMessage',{origin:origem,registrationId,data:JSON.stringify(data)});
  let result;
  for(let attempt=0;attempt<75&&!result;attempt++){
    const probe=await worker.evaluate(()=>self.probe);
    if(probe.error)throw Error(probe.error);
    result=probe.shown;
    if(!result)await new Promise(done=>setTimeout(done,200));
  }
  assert.deepEqual(result,[data.title,data.body,data.path,true]);await controle.close();
});
test('nenhum erro de JavaScript', () => {
  assert.deepEqual(erros, []);
});
