// "Supabase de mentira" para os testes de tela.
//
// Responde às chamadas que o app faz ao Supabase (login, funções RPC e
// consultas simples) usando o banco REAL do projeto: PGlite com as migrations
// de supabase/migrations e os dados fictícios de supabase/seed.sql. As regras
// de acesso (RLS) e as funções do servidor rodam de verdade; só a camada HTTP
// (Auth e PostgREST) é imitada, de forma simplificada.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TestDb } from '../supabase/tests/helpers/db.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SENHA_DEMO = 'Demo@2026!';
const PARSERS = { 1082: (v) => v }; // date fica 'AAAA-MM-DD', como no PostgREST
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
  'access-control-expose-headers': '*',
};

export async function criarServidorFalso() {
  const db = await TestDb.create();
  await db.pg.exec(readFileSync(join(raiz, 'supabase', 'seed.sql'), 'utf8'));

  // O PGlite tem uma conexão só: as requisições rodam uma de cada vez.
  let fila = Promise.resolve();
  const emSerie = (fn) => {
    const r = fila.then(fn, fn);
    fila = r.catch(() => undefined);
    return r;
  };
  const comoUsuario = (uid, sql, params = []) =>
    emSerie(async () => {
      await db.pg.exec(`set request.jwt.claim.sub = '${uid ?? ''}'`);
      await db.pg.exec(`set role ${uid ? 'authenticated' : 'anon'}`);
      try {
        return await db.pg.query(sql, params, { parsers: PARSERS });
      } finally {
        await db.pg.exec('reset role');
        await db.pg.exec('reset request.jwt.claim.sub');
      }
    });

  const { rows } = await db.pg.query(`
    select p.proname as name, p.proretset as set, p.prorettype::regtype::text as ret,
           coalesce(p.proargnames, '{}') as names,
           coalesce((select array_agg(t::regtype::text order by o)
                     from unnest(p.proargtypes::oid[]) with ordinality u(t, o)), '{}') as types
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'`);
  const funcoes = Object.fromEntries(rows.map((r) => [r.name, r]));

  const arrayPg = (a) =>
    '{' + a.map((x) => (x === null ? 'NULL' : '"' + String(x).replace(/["\\]/g, '\\$&') + '"')).join(',') + '}';
  const parametro = (valor, tipo) => {
    if (valor === null || valor === undefined) return null;
    if (tipo.endsWith('[]')) return arrayPg(valor);
    if (tipo === 'jsonb' || tipo === 'json') return JSON.stringify(valor);
    return String(valor);
  };

  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const usuarios = {};
  const buscarUsuario = async (campo, valor) =>
    (
      await db.pg.query(
        `select id, email, email_confirmed_at, raw_user_meta_data, created_at from auth.users where ${campo} = $1`,
        [valor],
      )
    ).rows[0];
  const sessao = (u) => {
    const agora = Math.floor(Date.now() / 1000);
    const user = {
      id: u.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: u.email,
      email_confirmed_at: u.email_confirmed_at,
      confirmed_at: u.email_confirmed_at,
      user_metadata: u.raw_user_meta_data,
      app_metadata: { provider: 'email', providers: ['email'] },
      created_at: u.created_at,
      updated_at: u.created_at,
      identities: [],
    };
    usuarios[u.id] = user;
    const claims = { sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', iat: agora, exp: agora + 86400 };
    return {
      access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.sem-assinatura`,
      token_type: 'bearer',
      expires_in: 86400,
      expires_at: agora + 86400,
      refresh_token: 'r-' + u.id,
      user,
    };
  };
  const uidDoToken = (headers) => {
    const partes = (headers['authorization'] ?? '').replace(/^Bearer /i, '').split('.');
    if (partes.length !== 3) return null;
    try {
      return JSON.parse(Buffer.from(partes[1], 'base64url').toString()).sub ?? null;
    } catch {
      return null;
    }
  };

  const resposta = (status, corpo) => ({
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
    body: corpo === undefined ? '' : JSON.stringify(corpo),
  });
  const vazio = { status: 204, headers: CORS, body: '' };
  const registro = [];

  /** Recebe um pedido do Playwright e devolve { status, headers, body }. */
  async function responder(req) {
    const url = new URL(req.url());
    const metodo = req.method();
    if (metodo === 'OPTIONS') return vazio;
    const headers = req.headers();
    const corpo = req.postData() ? JSON.parse(req.postData()) : {};
    const caminho = url.pathname;

    if (caminho === '/auth/v1/token') {
      const tipo = url.searchParams.get('grant_type');
      const u =
        tipo === 'password'
          ? await buscarUsuario('email', String(corpo.email ?? '').toLowerCase())
          : await buscarUsuario('id', String(corpo.refresh_token ?? '').slice(2));
      if (!u || (tipo === 'password' && corpo.password !== SENHA_DEMO)) {
        return resposta(400, { error: 'invalid_grant', code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      return resposta(200, sessao(u));
    }
    if (caminho === '/auth/v1/user') return resposta(200, usuarios[uidDoToken(headers)] ?? null);
    if (caminho === '/auth/v1/logout') return vazio;
    const uid = uidDoToken(headers);
    if (caminho.startsWith('/rest/v1/rpc/')) {
      const nome = caminho.slice('/rest/v1/rpc/'.length);
      const f = funcoes[nome];
      if (!f) return resposta(404, { code: 'PGRST202', message: `função ${nome} não existe` });
      const chaves = Object.keys(corpo);
      const tipos = chaves.map((k) => f.types[f.names.indexOf(k)]);
      const args = chaves.map((k, i) => `${k} => $${i + 1}::${tipos[i]}`).join(', ');
      const sql = f.set ? `select * from public.${nome}(${args})` : `select public.${nome}(${args}) as r`;
      try {
        const { rows: linhas } = await comoUsuario(
          uid,
          sql,
          chaves.map((k, i) => parametro(corpo[k], tipos[i])),
        );
        registro.push(`rpc ${nome}`);
        if (f.set) return resposta(200, linhas);
        return f.ret === 'void' ? vazio : resposta(200, linhas[0].r);
      } catch (e) {
        registro.push(`rpc ${nome} ERRO ${e.message}`);
        return resposta(400, { code: e.code ?? 'P0001', message: e.message, details: null, hint: null });
      }
    }
    if (caminho.startsWith('/rest/v1/') && metodo === 'GET') {
      const tabela = caminho.slice('/rest/v1/'.length);
      if (!/^[a-z_]+$/.test(tabela)) return resposta(400, { message: 'tabela inválida' });
      const colunas = (url.searchParams.get('select') ?? '*').replace(/[^a-z_,*]/g, '');
      let sql = `select ${colunas} from public.${tabela}`;
      const ordem = url.searchParams.get('order');
      if (ordem) {
        sql +=
          ' order by ' +
          ordem
            .split(',')
            .map((o) => {
              const [c, d] = o.split('.');
              return `${c.replace(/[^a-z_]/g, '')} ${d === 'desc' ? 'desc' : 'asc'}`;
            })
            .join(', ');
      }
      const limite = Number(url.searchParams.get('limit'));
      if (limite > 0) sql += ` limit ${limite}`;
      try {
        const { rows: linhas } = await comoUsuario(uid, sql);
        registro.push(`get ${tabela}`);
        return resposta(200, linhas);
      } catch (e) {
        registro.push(`get ${tabela} ERRO ${e.message}`);
        return resposta(400, { code: e.code, message: e.message });
      }
    }
    if (caminho === '/rest/v1/user_preferences' && metodo === 'PATCH') {
      const columns = Object.keys(corpo).filter(c => /^[a-z_]+$/.test(c));
      const target = url.searchParams.get('user_id')?.replace(/^eq\./, '');
      if (!columns.length || !target) return resposta(400, { message: 'alteração inválida' });
      try {
        await comoUsuario(uid, `update public.user_preferences prefs set (${columns.join(',')}) = (select ${columns.join(',')} from json_populate_record(null::public.user_preferences, $1::json)) where prefs.user_id=$2::uuid`, [JSON.stringify(corpo),target]);
        registro.push('patch user_preferences');
        return vazio;
      } catch (e) {
        registro.push(`patch user_preferences ERRO ${e.message}`);
        return resposta(400, { code: e.code, message: e.message });
      }
    }
    if (caminho.startsWith('/rest/v1/') && metodo === 'POST') {
      // Inserção (ex.: criar agenda): só as colunas enviadas; as demais ficam com o valor padrão.
      const tabela = caminho.slice('/rest/v1/'.length);
      const colunas = Object.keys(corpo).filter((c) => /^[a-z_]+$/.test(c));
      if (!/^[a-z_]+$/.test(tabela) || !colunas.length) return resposta(400, { message: 'inserção inválida' });
      const retorno = (url.searchParams.get('select') ?? '*').replace(/[^a-z_,*]/g, '') || '*';
      const sql =
        `insert into public.${tabela} (${colunas.join(', ')}) ` +
        `select ${colunas.join(', ')} from json_populate_record(null::public.${tabela}, $1::json) ` +
        `returning ${retorno}`;
      try {
        const { rows: linhas } = await comoUsuario(uid, sql, [JSON.stringify(corpo)]);
        registro.push(`post ${tabela}`);
        const umSo = (headers['accept'] ?? '').includes('vnd.pgrst.object');
        return resposta(201, umSo ? linhas[0] : linhas);
      } catch (e) {
        registro.push(`post ${tabela} ERRO ${e.message}`);
        return resposta(400, { code: e.code, message: e.message, details: null, hint: null });
      }
    }
    registro.push(`${metodo} ${caminho} (não simulado)`);
    return resposta(200, []);
  }

  const eventos = Object.fromEntries(
    (await db.pg.query('select title, id from public.events where deleted_at is null')).rows.map((r) => [
      r.title,
      r.id,
    ]),
  );

  return { responder, registro, eventos, fechar: () => db.close() };
}
