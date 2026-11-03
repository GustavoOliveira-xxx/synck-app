import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectError, uuid, eventPayload } from './helpers/db.mjs';
import { setupGroup } from './helpers/scenario.mjs';

const period = { id: 'sono', title: 'Sono', kind: 'sleep', days: [0,1,2,3,4,5,6], start: '23:00', end: '07:00', timezone: 'America/Sao_Paulo', enabled: true };
test('rotina é privada, validada e acompanha a conta e a exportação', async () => {
  const { db, ana, bruno } = await setupGroup();
  try {
    await db.as(ana, 'update public.user_preferences set routine_periods=$1 where user_id=$2', [JSON.stringify([period]), ana]);
    const account = await db.rpc(ana, 'get_my_account');
    assert.deepEqual(account.preferences.routine_periods, [period]);
    const other = await db.as(bruno, 'select routine_periods from public.user_preferences where user_id=$1', [ana]);
    assert.equal(other.rows.length, 0);
    await db.as(bruno, 'update public.user_preferences set routine_periods=\'[]\' where user_id=$1', [ana]);
    assert.deepEqual((await db.rpc(ana, 'get_my_account')).preferences.routine_periods, [period]);
    for (const patch of [{days:[]},{days:[1,1]},{days:[7]},{start:'24:00'},{end:'23:00'},{timezone:'invalido'},{title:''},{enabled:'true'}])
      await expectError(db.as(ana, 'update public.user_preferences set routine_periods=$1 where user_id=$2', [JSON.stringify([{...period,...patch}]),ana]), 'INVALID_ROUTINE');
    await expectError(db.as(ana,'update public.user_preferences set routine_periods=$1 where user_id=$2',[JSON.stringify([period,period]),ana]),'INVALID_ROUTINE');
    assert.deepEqual((await db.rpc(ana,'export_my_data')).preferences.routine_periods,[period]);
  } finally { await db.close(); }
});
test('decoração de evento cria, edita, remove e respeita máscara e papéis', async () => {
  const {db,ana,bruno,davi,cal}=await setupGroup();
  try {
    const id=uuid();
    const create=await db.rpc(ana,'apply_event_op',[uuid(),'create',id,eventPayload(cal,{decoration:'decor-flor',privacy:'busy'})]);
    assert.equal(create.status,'ok');
    assert.equal(create.event.decoration,'decor-flor');
    const list=async user=>(await db.as(user,'select * from public.list_events(null,$1,$2)',['2026-11-01','2026-12-01'])).rows;
    assert.equal((await list(ana))[0].decoration,'decor-flor');
    assert.equal((await list(bruno))[0].decoration,null);
    const denied=await db.rpc(davi,'apply_event_op',[uuid(),'update',id,{decoration:'decor-lua'},1]);
    assert.notEqual(denied.status,'ok');
    const duplicate=await db.rpc(ana,'duplicate_calendar',[cal,'Agenda decorada',true]);
    const copied=await db.as(ana,'select decoration from public.events where calendar_id=$1',[duplicate]);
    assert.equal(copied.rows[0].decoration,'decor-flor');
    const updated=await db.rpc(ana,'apply_event_op',[uuid(),'update',id,{decoration:'decor-lua'},1]);
    assert.equal(updated.event.decoration,'decor-lua');
    const removed=await db.rpc(ana,'apply_event_op',[uuid(),'update',id,{decoration:null},updated.event.version]);
    assert.equal(removed.event.decoration,null);
  } finally { await db.close(); }
});
test('tarefas, notas e hábitos preservam desenhos sem expor itens privados', async () => {
  const {db,ana,bruno}=await setupGroup();
  try {
    for(const entity of ['task','note','habit']) {
      const id=uuid();
      const create=await db.rpc(ana,'apply_item_op',[uuid(),entity,'create',id,{title:'Teste',body:'Nota',decoration:'decor-sol'}]);
      assert.equal(create.status,'ok',JSON.stringify(create));
      assert.equal(create[entity].decoration,'decor-sol');
      const update=await db.rpc(ana,'apply_item_op',[uuid(),entity,'update',id,{decoration:'decor-folha'},create[entity].version]);
      assert.equal(update[entity].decoration,'decor-folha');
      const own=await db.rpc(ana,'list_my_items',[null]);
      assert.equal(own[entity==='habit'?'habits':entity+'s'][0].decoration,'decor-folha');
      const other=await db.rpc(bruno,'list_my_items',[null]);
      assert.equal(other[entity==='habit'?'habits':entity+'s'].length,0);
    }
  } finally {await db.close();}
});
