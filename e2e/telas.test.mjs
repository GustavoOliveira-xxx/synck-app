// Testes de tela (ponta a ponta) na versão web do app.
//
// Abre o app num navegador com tamanho de celular, entra com as contas
// fictícias do seed e confere as telas principais e as regras de privacidade
// pela interface. O servidor é o "Supabase de mentira" de servidor-falso.mjs,
// que usa o banco real do projeto (PGlite + migrations + seed).
//
// Pré-requisito: a versão web exportada em app-mobile/dist-e2e (npm run preparar).
// Capturas de cada etapa ficam em e2e/saida/.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import http from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

import { criarServidorFalso, SENHA_DEMO } from './servidor-falso.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const WEB = process.env.WEB_DIR ?? join(aqui, '..', 'app-mobile', 'dist-e2e');
const SAIDA = join(aqui, 'saida');
const API = 'https://demonstracao.supabase.co';
const AGENDA = 'c0000000-0000-4000-8000-000000000001';
// Como no GitHub Pages: o app fica numa subpasta e a raiz do domínio responde 404.
const SUBPASTA = '/synck-app';

let site;
let base;
let servidor;
let navegador;
const erros = [];

function servirSite(pasta) {
  const tipos = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.ttf': 'font/ttf' };
  return http.createServer((req, res) => {
    const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (caminho !== SUBPASTA && !caminho.startsWith(`${SUBPASTA}/`)) {
      res.writeHead(404);
      return res.end();
    }
    let arquivo = join(pasta, caminho.slice(SUBPASTA.length));
    if (!arquivo.startsWith(pasta) || !existsSync(arquivo) || statSync(arquivo).isDirectory()) {
      arquivo = join(pasta, 'index.html');
    }
    res.writeHead(200, { 'content-type': tipos[extname(arquivo)] ?? 'application/octet-stream' });
    createReadStream(arquivo).pipe(res);
  });
}

async function abrirSessao(tema = 'light', viewport = { width: 390, height: 844 }) {
  const ctx = await navegador.newContext({
    viewport,
    colorScheme: tema,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // O service worker (modo offline) é testado em site.test.mjs; aqui ele atrapalharia a simulação do servidor.
    serviceWorkers: 'block',
  });
  await ctx.route(`${API}/**`, async (route) => route.fulfill(await servidor.responder(route.request())));
  await ctx.routeWebSocket(/realtime/, () => {}); // tempo real fica de fora destes testes
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(`erro na página: ${e.message}`));
  page.on('console', (m) => {
    // "Failed to load resource" é o navegador registrando respostas de erro do servidor
    // (como a senha errada, de propósito); falhas reais do servidor são checadas no fim.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) {
      erros.push(`console: ${m.text().slice(0, 300)}`);
    }
  });
  return page;
}

/** Espera a abertura animada (logo SynCK) sair da frente. */
const semAbertura = (page) => page.getByTestId('abertura').waitFor({ state: 'detached', timeout: 15_000 });

async function entrar(page, email) {
  await page.goto(`${base}/login`);
  await semAbertura(page);
  await page.locator('input').nth(0).fill(email);
  await page.locator('input').nth(1).fill(SENHA_DEMO);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByText(/^(Bom dia|Boa tarde|Boa noite),/).first().waitFor({ timeout: 20_000 });
  // Na primeira abertura do dia o app pergunta "O que você pretende fazer hoje?".
  const pular = page.getByText('Agora não', { exact: true }).first();
  if (await pular.waitFor({ timeout: 5_000 }).then(() => true, () => false)) {
    await foto(page, `00-plano-do-dia-${email.split('.')[0]}`);
    await pular.click();
    await pular.waitFor({ state: 'detached', timeout: 10_000 });
  }
}

async function ir(page, caminho) {
  await page.goto(base + caminho);
  await page.waitForLoadState('networkidle');
  await semAbertura(page);
}

/**
 * No navegador, as animações de entrada e de layout do Reanimated podem deixar
 * um elemento com posição absoluta: ele sai do fluxo e o que vem depois sobe
 * por cima dele. O app não usa mais essas animações na web (MotionView); esta
 * conferência roda antes de cada captura para pegar qualquer volta delas.
 */
async function semAnimacaoPresa(page, tela) {
  await page.waitForTimeout(900);
  const presos = await page.evaluate(() =>
    [...document.querySelectorAll('[style*="animation-name"]')]
      .filter((el) => /^(REA-|Fade|Slide|Zoom|Bounce|Flip|Stretch|LightSpeed|Pinwheel|Roll|Rotate)/.test(el.style.animationName))
      .map((el) => `${el.style.animationName} (${getComputedStyle(el).position}): ${el.textContent.slice(0, 60)}`),
  );
  assert.deepEqual(presos, [], `animação de layout presa na tela ${tela}`);
}

const foto = async (page, nome) => {
  await semAnimacaoPresa(page, nome);
  await page.screenshot({ path: join(SAIDA, `${nome}.png`) });
};
const visivel = (page, texto) => page.getByText(texto, { exact: false }).first().waitFor({ timeout: 15_000 });

before(async () => {
  assert.ok(existsSync(join(WEB, 'index.html')), `Versão web não encontrada em ${WEB}. Rode: npm run preparar`);
  mkdirSync(SAIDA, { recursive: true });
  servidor = await criarServidorFalso();
  site = servirSite(WEB);
  await new Promise((ok) => site.listen(0, ok));
  base = `http://localhost:${site.address().port}${SUBPASTA}`;
  navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});

after(async () => {
  await navegador?.close();
  site?.close();
  await servidor?.fechar();
});

test('primeiro acesso: apresentação e tela de login', async () => {
  const page = await abrirSessao();
  await page.goto(base);
  await semAbertura(page);
  await visivel(page, 'Sua rotina, sincronizada com quem importa.');
  await foto(page, '01-apresentacao');
  await ir(page, '/login');
  await visivel(page, 'Esqueci a senha');
  // Sem o Google ativado no servidor, o botão explica em vez de abrir uma página de erro.
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  await visivel(page, 'ainda não foi ativada');
  await foto(page, '01-login');
  await page.context().close();
});

test('senha errada mostra mensagem compreensível', async () => {
  const page = await abrirSessao();
  await page.goto(`${base}/login`);
  await semAbertura(page);
  await page.locator('input').nth(0).fill('ana.demo@exemplo.test');
  await page.locator('input').nth(1).fill('SenhaErrada1');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await visivel(page, 'E-mail ou senha incorretos.');
  await foto(page, '02-senha-errada');
  await page.context().close();
});

test('proprietária: calendário, evento, membros, convite e demais telas', async () => {
  const page = await abrirSessao();
  await entrar(page, 'ana.demo@exemplo.test');
  await foto(page, '03-hoje');
  await ir(page, '/month');
  await visivel(page, 'Mês');
  await foto(page, '03-agenda-mes');

  await page.getByText('Lista', { exact: true }).click();
  await visivel(page, 'Jantar de aniversário');
  await visivel(page, 'Consulta médica'); // "ocupado" para membros, mas a proprietária vê tudo
  assert.equal(await page.getByText('Comprar presente').count(), 0, 'evento privado de outra pessoa apareceu');
  await foto(page, '04-agenda-lista');

  await ir(page, `/event/${servidor.eventos['Jantar de aniversário']}`);
  await visivel(page, 'Restaurante Central');
  await visivel(page, 'de outubro de'); // data por extenso
  await foto(page, '05-evento-detalhe');

  await ir(page, `/calendar/${AGENDA}/members`);
  for (const nome of ['Bruno Demo', 'Carla Demo', 'Davi Demo']) await visivel(page, nome);
  await visivel(page, 'Visualizador');
  await foto(page, '06-membros');

  await ir(page, `/calendar/${AGENDA}/invite`);
  await page.getByRole('button', { name: 'Gerar convite' }).click();
  const codigo = page.getByText(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  await codigo.waitFor({ timeout: 15_000 });
  await foto(page, '07-convite');

  for (const [caminho, texto, nome] of [
    ['/event/new', 'Novo evento', '08-evento-novo'],
    ['/calendars', 'Casa (demonstração)', '09-agendas'],
    ['/notifications', 'Nova pessoa em Casa', '10-avisos'],
    ['/profile', 'Ana Demo', '11-perfil'],
    ['/sync', 'Tudo sincronizado', '12-sincronizacao'],
    [`/calendar/${AGENDA}/history`, 'criou', '13-historico'],
    ['/search', 'Buscar', '14-busca'],
    ['/filters', 'Filtros', '15-filtros'],
    ['/help', 'Ajuda', '16-ajuda'],
  ]) {
    await ir(page, caminho);
    await visivel(page, texto);
    await foto(page, nome);
  }
  await page.context().close();
});

test('visualizador: vê "Ocupado" no lugar de detalhes e não vê eventos privados', async () => {
  const page = await abrirSessao('dark');
  await entrar(page, 'davi.demo@exemplo.test');
  await foto(page, '17-hoje-escuro');
  await ir(page, '/month');
  await page.getByText('Lista', { exact: true }).click();
  await visivel(page, 'Jantar de aniversário');
  await visivel(page, 'Ocupado');
  assert.equal(await page.getByText('Consulta médica').count(), 0, 'detalhes de evento "ocupado" vazaram');
  assert.equal(await page.getByText('Comprar presente').count(), 0, 'evento privado apareceu');
  await foto(page, '17-visualizador-escuro');
  await page.context().close();
});

test('computador: menu lateral, mês e eventos do dia lado a lado', async () => {
  const page = await abrirSessao('light', { width: 1280, height: 800 });
  await entrar(page, 'ana.demo@exemplo.test');
  // Menu lateral: o item "Agendas" fica na coluna da esquerda, no alto da tela.
  const item = await page.getByText('Agendas', { exact: true }).first().boundingBox();
  assert.ok(item && item.x < 248 && item.y < 400, `menu lateral fora do lugar: ${JSON.stringify(item)}`);
  await foto(page, '18-computador-hoje');
  await ir(page, '/month');
  // Duas colunas: a grade do mês à esquerda e o título do dia (cabeçalho) à direita.
  const dia = page.getByRole('heading', { name: /-feira|sábado|domingo/i }).first();
  await dia.waitFor({ timeout: 15_000 });
  const caixa = await dia.boundingBox();
  assert.ok(caixa && caixa.x > 640, `lista do dia deveria estar na coluna da direita: ${JSON.stringify(caixa)}`);
  await foto(page, '18-computador-agenda');
  await ir(page, `/event/${servidor.eventos['Jantar de aniversário']}`);
  await visivel(page, 'Restaurante Central');
  const titulo = await page.getByText('Jantar de aniversário').first().boundingBox();
  assert.ok(titulo && titulo.x > 200, 'o conteúdo deveria ficar centralizado, não colado na borda');
  await foto(page, '19-computador-evento');

  // Com conexão, o app não pode se achar offline (no GitHub Pages a raiz do domínio dá 404).
  assert.equal(await page.getByText('Sem internet', { exact: false }).count(), 0, 'aviso "Sem internet" com conexão');
  // Criar uma agenda e gerar um convite para ela pelo computador.
  await ir(page, '/calendar/new');
  await page.locator('input').first().fill('Agenda do computador');
  await page.getByRole('button', { name: 'Criar agenda' }).click();
  await visivel(page, 'Agenda do computador');
  const novaAgenda = page.url().match(/calendar\/([0-9a-f-]{36})/)?.[1];
  assert.ok(novaAgenda, `não abriu a agenda criada: ${page.url()}`);
  await ir(page, `/calendar/${novaAgenda}/invite`);
  await page.getByRole('button', { name: 'Gerar convite' }).click();
  await page.getByText(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/).waitFor({ timeout: 15_000 });
  await foto(page, '21-computador-convite');
  await page.context().close();
});

test('tablet: menu lateral e formulário centralizado', async () => {
  const page = await abrirSessao('light', { width: 820, height: 1180 });
  await entrar(page, 'ana.demo@exemplo.test');
  const item = await page.getByText('Perfil', { exact: true }).first().boundingBox();
  assert.ok(item && item.x < 248 && item.y < 500, `menu lateral fora do lugar: ${JSON.stringify(item)}`);
  await ir(page, '/event/new');
  await visivel(page, 'Título');
  await foto(page, '20-tablet-novo-evento');
  await page.context().close();
});

test('3.0: tarefas, criação universal, planejamento, horário em comum e busca', async () => {
  const page = await abrirSessao();
  await entrar(page, 'ana.demo@exemplo.test');

  await ir(page, '/tasks');
  const rapida = page.getByPlaceholder('Adicionar tarefa (ex.: Comprar pão amanhã)');
  await rapida.fill('Comprar pão amanhã');
  await rapida.press('Enter');
  // Com prazo amanhã, a tarefa não entra em "Meu dia" de hoje: aparece nos próximos dias.
  await page.getByText(/^Próximos 7 dias/).first().click();
  await visivel(page, 'Comprar pão');
  await foto(page, '22-tarefas');

  await ir(page, '/create');
  await visivel(page, 'O que você deseja adicionar?');
  await foto(page, '23-criar');

  await ir(page, '/planner');
  await foto(page, '24-planejador');
  await ir(page, '/week');
  await visivel(page, 'Minha semana em sintonia');
  await foto(page, '25-semana');

  await ir(page, `/calendar/${AGENDA}/find-time`);
  await page.getByText('Procurar horários', { exact: true }).click();
  await visivel(page, 'Horários livres para todos');
  await foto(page, '26-encontrar-horario');

  await ir(page, '/search');
  await page.locator('input').first().fill('pão');
  await visivel(page, 'Comprar pão');
  await foto(page, '27-busca-tudo');

  await ir(page, '/notes');
  await foto(page, '28-anotacoes');
  await ir(page, '/habits');
  await foto(page, '29-habitos');
  await page.context().close();
});

test('"Seu dia" aberto pelo endereço: cadastro completo e sair sem a pergunta voltar', async () => {
  const page = await abrirSessao();
  await entrar(page, 'bruno.demo@exemplo.test');

  // Sem tela anterior (recarregou ou abriu pelo link): os botões precisam funcionar.
  await ir(page, '/plan-day');
  await visivel(page, 'Cadastre por aqui');
  await foto(page, '30-seu-dia');
  await page.getByRole('button', { name: 'Tarefa', exact: true }).click();
  await visivel(page, 'Data do prazo');
  await visivel(page, 'Definir horário');
  await foto(page, '31-seu-dia-tarefa-completa');

  await ir(page, '/plan-day');
  await page.getByText('Agora não', { exact: true }).first().click();
  await page.getByText(/^(Bom dia|Boa tarde|Boa noite),/).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_500);
  assert.ok(!page.url().includes('/plan-day'), `a pergunta abriu de novo: ${page.url()}`);
  assert.equal(await page.getByText('Agora não', { exact: true }).count(), 0, 'a pergunta abriu de novo');

  await ir(page, '/plan-day');
  await page.getByText('Começar o dia', { exact: true }).first().click();
  await page.getByText(/^(Bom dia|Boa tarde|Boa noite),/).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_500);
  assert.ok(!page.url().includes('/plan-day'), `a pergunta abriu de novo: ${page.url()}`);
  assert.equal(await page.getByText('Agora não', { exact: true }).count(), 0, 'a pergunta abriu de novo');
  await page.context().close();
});

test('tela Hoje no computador: seções não ficam umas por cima das outras', async () => {
  const page = await abrirSessao('dark', { width: 1917, height: 875 });
  await entrar(page, 'carla.demo@exemplo.test');
  await ir(page, '/tasks');
  const rapida = page.getByPlaceholder('Adicionar tarefa (ex.: Comprar pão amanhã)');
  await rapida.fill('1 hora de curso de java');
  await rapida.press('Enter');
  await visivel(page, '1 hora de curso de java');
  await ir(page, '/');
  await visivel(page, '1 hora de curso de java');
  await foto(page, '32-hoje-computador-com-tarefa');
  const caixas = await page.evaluate(() => {
    const ret = (el) => {
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, texto: el.textContent.slice(0, 40) };
    };
    // Cabeçalhos das seções recolhíveis: o rótulo termina em "Recolher" ou "Mostrar".
    const ehCabecalho = (el) => /\. (Recolher|Mostrar)$/.test(el.getAttribute('aria-label') ?? '');
    const todos = [...document.querySelectorAll('[role="button"], [role="checkbox"]')];
    const cabecalhos = todos.filter(ehCabecalho).map(ret);
    const itens = todos
      .filter((el) => !ehCabecalho(el) && el.getBoundingClientRect().height > 30)
      .map(ret);
    return { cabecalhos, itens };
  });
  assert.ok(caixas.cabecalhos.length >= 2, 'a tela Hoje deveria ter seções');
  for (const c of caixas.cabecalhos) {
    for (const i of caixas.itens) {
      const sobrepoe = c.top < i.bottom - 1 && i.top < c.bottom - 1;
      assert.ok(!sobrepoe, `"${c.texto}" está por cima de "${i.texto}"`);
    }
  }
  await page.context().close();
});

test('nenhum erro de JavaScript em nenhuma tela', () => {
  assert.deepEqual(erros, []);
  const falhas = servidor.registro.filter((r) => r.includes('ERRO'));
  assert.deepEqual(falhas, [], 'chamadas ao servidor falharam');
});
