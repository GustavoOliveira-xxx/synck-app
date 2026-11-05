import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TestDb, expectError } from './helpers/db.mjs';

const PALETA = ['#017A68', '#D9472A', '#A86F00', '#2B6CB0', '#7E46BF', '#B83A66', '#5E7A16', '#55707A'];

test('conta criada pelo Google usa o nome do Google e as cores SynCK', async () => {
  const db = await TestDb.create();
  const { rows } = await db.pg.query(
    `insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
     values ('bia@gmail.test', now(), '{"full_name":"Bia Souza","avatar_url":"https://x"}') returning id`,
  );
  const account = await db.rpc(rows[0].id, 'get_my_account');
  assert.equal(account.display_name, 'Bia Souza');
  assert.ok(PALETA.includes(account.avatar_color), `cor fora da paleta: ${account.avatar_color}`);
  const { rows: cals } = await db.as(rows[0].id, 'select color from public.list_my_calendars()');
  assert.equal(cals[0].color, '#017A68');
  await db.close();
});

test('notificações do navegador: cada um só vê e apaga a própria inscrição', async () => {
  const db = await TestDb.create();
  const ana = await db.createUser('ana@exemplo.test', 'Ana');
  const bruno = await db.createUser('bruno@exemplo.test', 'Bruno');
  const endpoint = 'https://push.exemplo.test/abc';
  await db.rpc(ana, 'register_push_subscription', [endpoint, 'chave', 'segredo', 'Safari']);

  assert.equal(await db.rpc(ana,'my_push_subscription_active',[endpoint]),true);
  assert.equal(await db.rpc(bruno,'my_push_subscription_active',[endpoint]),false);
  let mine = await db.as(ana, 'select endpoint from public.push_subscriptions');
  assert.equal(mine.rows.length, 1);
  const others = await db.as(bruno, 'select endpoint from public.push_subscriptions');
  assert.equal(others.rows.length, 0, 'Bruno viu a inscrição da Ana');

  // Inscrição direta na tabela não é permitida (só pela função).
  await expectError(
    db.as(bruno, `insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://x', 'a', 'b')`, [ana]),
    'permission denied',
  );

  // O mesmo navegador, agora com a conta do Bruno, passa a ser dele.
  await db.rpc(bruno, 'register_push_subscription', [endpoint, 'chave2', 'segredo2', 'Safari']);
  mine = await db.as(ana, 'select endpoint from public.push_subscriptions');
  assert.equal(mine.rows.length, 0);

  // Ana não consegue desligar a do Bruno.
  await db.rpc(ana, 'unregister_push_subscription', [endpoint]);
  assert.equal((await db.as(bruno, 'select 1 from public.push_subscriptions')).rows.length, 1);
  await db.rpc(bruno, 'unregister_push_subscription', [endpoint]);
  assert.equal(await db.rpc(bruno,'my_push_subscription_active',[endpoint]),false);
  assert.equal((await db.as(bruno, 'select 1 from public.push_subscriptions')).rows.length, 0);

  // Sem login não inscreve; a chave pública pode ser lida, a privada fica escondida.
  await expectError(db.rpc(null, 'register_push_subscription', [endpoint, 'a', 'b', null]), 'permission denied');
  assert.equal(await db.rpc(null, 'web_push_public_key'), null);
  await expectError(db.as(ana, 'select private_key from private.web_push_config'), 'permission denied');
  await db.close();
});
