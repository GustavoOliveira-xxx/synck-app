import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupGroup } from './helpers/scenario.mjs';
import { uuid, eventPayload } from './helpers/db.mjs';

test('blocos pessoais ficam privados e notas compartilhadas rejeitam o vínculo', async () => {
  const {db,ana,davi,cal}=await setupGroup();
  try {
    const task=uuid(), block=uuid(), title='Relatório pessoal';
    const op=(entity,id,payload)=>db.rpc(ana,'apply_item_op',[uuid(),entity,'create',id,payload,null,'app']);
    await op('task',task,{title});
    const result=await db.rpc(ana,'apply_event_op',[uuid(),'create',block,eventPayload(cal,{title,task_id:task,privacy:'members'}),null,'app']);
    assert.equal(result.event.privacy,'private');
    const list=async user=>(await db.as(user,'select id,task_id,title from public.list_events(null,$1,$2)',['2026-01-01','2027-01-01'])).rows;
    assert.equal((await list(ana)).find(e=>e.id===block).task_id,task);
    assert.equal((await list(davi)).some(e=>e.id===block || e.task_id===task || e.title===title),false);
    const denied=await op('note',uuid(),{body:'Diretrizes',calendar_id:cal,task_id:task});
    assert.equal(denied.status,'error');
    const mine=await op('note',uuid(),{body:'Diretrizes',task_id:task});assert.equal(mine.status,'ok');
    assert.equal((await db.rpc(davi,'list_my_items',[null])).notes.some(n=>n.task_id===task),false);
    const team=uuid();await op('task',team,{title:'Tarefa em comum',calendar_id:cal,privacy:'members'});
    const note=uuid();
    assert.equal((await op('note',note,{body:'Pauta',calendar_id:cal,task_id:team})).status,'ok');
    const shared=uuid();
    await db.rpc(ana,'apply_event_op',[uuid(),'create',shared,eventPayload(cal,{task_id:team}),null,'app']);
    const {rows}=await db.admin('select version from public.tasks where id=$1',[team]);
    const narrowed=await db.rpc(ana,'apply_item_op',[uuid(),'task','update',team,{privacy:'private'},rows[0].version,'app']);
    assert.equal(narrowed.status,'ok',JSON.stringify(narrowed));
    assert.equal((await list(davi)).some(e=>e.id===shared),false);
    assert.equal((await db.rpc(davi,'list_my_items',[null])).notes.find(n=>n.id===note).task_id,null);
  } finally {await db.close();}
});

test('enquete conserva votos e lê o horário atual apenas enquanto a reunião for visível', async()=>{
  const {db,ana,bruno,cal}=await setupGroup();
  try {
    const options=[{starts_at:'2026-11-12T22:00Z',ends_at:'2026-11-12T23:00Z'},{starts_at:'2026-11-13T22:00Z',ends_at:'2026-11-13T23:00Z'}];
    const poll=await db.rpc(ana,'create_poll',[cal,'Reunião',null,60,'UTC',null,[bruno],options]);
    const get=async()=>(await db.rpc(bruno,'list_polls',[cal]))[0];
    const chosen=(await get()).options[0];await db.rpc(bruno,'vote_poll',[chosen.id,'yes']);
    const {event_id}=await db.rpc(ana,'close_poll',[poll,chosen.id,true]);
    const update=async payload=>{
      const {rows}=await db.admin('select version from public.events where id=$1',[event_id]);
      const r=await db.rpc(ana,'apply_event_op',[uuid(),'update',event_id,payload,rows[0].version,'app']);assert.equal(r.status,'ok');
    };
    await update({starts_at:'2026-11-19T12:00Z',ends_at:'2026-11-19T13:00Z'});
    const current=await get();assert.equal(Date.parse(current.meeting.starts_at),Date.parse('2026-11-19T12:00Z'));
    assert.equal(current.chosen_option_id,chosen.id);assert.equal(current.options[0].starts_at,chosen.starts_at);
    await update({status:'cancelled'});assert.equal((await get()).meeting.status,'cancelled');
    await update({privacy:'private'});assert.equal((await get()).meeting,null);assert.equal((await get()).event_id,null);
  } finally {await db.close();}
});
