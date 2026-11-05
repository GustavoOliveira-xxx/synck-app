import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setupGroup} from './helpers/scenario.mjs';
import {uuid,eventPayload,expectError} from './helpers/db.mjs';
test('contexto é individual, segue permissões e não altera a reunião nem a rotina',async()=>{
 const {db,ana,bruno,fabio,cal}=await setupGroup();try{
 const id=uuid(),key='event:'+id;
 const op=await db.rpc(ana,'apply_event_op',[uuid(),'create',id,eventPayload(cal,{personal_context:'work'}),null,'app']);assert.equal(op.status,'ok');
 const contexts=async u=>(await db.rpc(u,'get_my_account')).contexts;
 assert.equal((await contexts(ana))[key],'work');assert.equal((await contexts(bruno))[key],undefined);
 await db.rpc(bruno,'set_my_item_context',['event',id,'school']);assert.equal((await contexts(bruno))[key],'school');assert.equal((await contexts(ana))[key],'work');
 await expectError(db.rpc(fabio,'set_my_item_context',['event',id,'work']),'NOT_FOUND');
 await db.rpc(ana,'apply_event_op',[uuid(),'update',id,{privacy:'private'},op.event.version,'app']);
 assert.equal((await contexts(bruno))[key],undefined);
 }finally{await db.close()}
});
test('conclusão guarda etapas da ocorrência e reabrir recompõe as marcações',async()=>{
 const {db,ana,cal,davi}=await setupGroup();try{
 const id=uuid(),a=uuid(),b=uuid();
 const op=(kind,p)=>db.rpc(ana,'apply_item_op',[uuid(),'task',kind,id,p,null,'app']);
 await op('create',{title:'Sistema',calendar_id:cal,privacy:'members',recurrence_rule:'FREQ=WEEKLY',due_date:'2026-11-09',checklist:[{id:a,title:'Esboço'},{id:b,title:'Entrega'}],personal_context:'work'});
 const block=uuid();await db.rpc(ana,'apply_event_op',[uuid(),'create',block,eventPayload(cal,{task_id:id}),null,'app']);
 await op('checklist_upsert',{id:a,done:true});const done=await op('complete',{occurrence_date:'2026-11-09'});assert.equal(done.task.checklist.find(s=>s.id===a).done,false);
 const listed=await db.as(ana,'select task_occurrence_date::text as cycle from public.list_events(null,$1,$2) where id=$3',['2026-01-01','2027-01-01',block]);assert.equal(listed.rows[0].cycle,'2026-11-09');
 const hist=(await db.rpc(ana,'list_task_history',[id])).find(e=>e.kind==='completion');assert.equal(hist.steps.find(s=>s.id===a).done,true);
 const reopened=await op('reopen',{occurrence_date:'2026-11-09'});assert.equal(reopened.task.checklist.find(s=>s.id===a).done,true);
 await expectError(db.rpc(davi,'promote_checklist_step',[id,b]),'NOT_FOUND');
 const child=await db.rpc(ana,'promote_checklist_step',[id,b]);const items=await db.rpc(ana,'list_my_items',[null]);assert.equal(items.tasks.find(t=>t.id===child).title,'Entrega');assert.equal(items.tasks.find(t=>t.id===id).checklist.length,1);
 await expectError(db.rpc(ana,'promote_checklist_step',[id,b]),'NOT_FOUND');
 }finally{await db.close()}
});
test('nota pessoal referencia reunião, histórico e lixeira respeitam o usuário',async()=>{
 const {db,ana,bruno,cal}=await setupGroup();try{
 const id=uuid(),event=uuid();
 await db.rpc(ana,'apply_event_op',[uuid(),'create',event,eventPayload(cal,{privacy:'private'}),null,'app']);
 const op=(kind,p)=>db.rpc(ana,'apply_item_op',[uuid(),'note',kind,id,p,null,'app']);
 const n=await op('create',{body:'Rascunho',event_id:event,personal_context:'work'});assert.equal(n.note.event_id,event);
 await op('update',{body:'Versão atual'});assert.equal((await db.rpc(ana,'note_versions',[id]))[0].body,'Rascunho');assert.deepEqual(await db.rpc(bruno,'note_versions',[id]),[]);
 await op('delete',{});assert.ok((await db.rpc(ana,'my_deleted_notes')).some(n=>n.id===id));assert.deepEqual(await db.rpc(bruno,'my_deleted_notes'),[]);
 assert.equal((await op('restore',{})).note.body,'Versão atual');
 }finally{await db.close()}
});
