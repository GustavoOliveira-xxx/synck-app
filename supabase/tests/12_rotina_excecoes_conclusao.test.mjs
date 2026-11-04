import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setupGroup} from './helpers/scenario.mjs';
import {uuid,eventPayload,expectError} from './helpers/db.mjs';
const routine={id:'gym',title:'Academia',kind:'exercise',days:[1,2,3,4,5],start:'18:00',end:'19:00',timezone:'America/Sao_Paulo',enabled:true};
test('exceções sincronizam sem sobrescrever alterações de outro aparelho',async()=>{
 const {db,ana,bruno}=await setupGroup();try{
 await db.rpc(ana,'save_my_routine',[[routine],[]]);
 const changed=[{...routine,exceptions:[{original_date:'2026-11-09',action:'skip'}]}];
 await db.rpc(ana,'save_my_routine',[changed,[routine]]);
 await expectError(db.rpc(ana,'save_my_routine',[[{...routine,title:'Antigo'}],[routine]]),'ROUTINE_CHANGED');
 assert.deepEqual((await db.rpc(ana,'get_my_account')).preferences.routine_periods,changed);
 await expectError(db.rpc(bruno,'save_my_routine',[[],changed]),'ROUTINE_CHANGED');
 assert.deepEqual((await db.rpc(ana,'export_my_data')).preferences.routine_periods,changed);
 }finally{await db.close();}
});
test('exceções rejeitam datas, horários e duplicações inválidas',async()=>{
 const {db,ana}=await setupGroup();try{
 for(const exceptions of [[{original_date:'x',action:'skip'}],[{original_date:'2026-11-09',action:'move'}],[{original_date:'2026-11-09',action:'move',starts_at:'2026-11-09T12:00:00Z',ends_at:'2026-11-09T11:00:00Z'}],[{original_date:'2026-11-09',action:'skip'},{original_date:'2026-11-09',action:'skip'}]])
 await expectError(db.rpc(ana,'save_my_routine',[[{...routine,exceptions}],[]]),'INVALID_ROUTINE_EXCEPTION');
 }finally{await db.close();}
});
test('concluir reunião recorrente mantém a série e preserva edição da ocorrência',async()=>{
 const {db,ana,davi,cal}=await setupGroup();try{
 const id=uuid();
 await db.rpc(ana,'apply_event_op',[uuid(),'create',id,eventPayload(cal,{recurrence_rule:'FREQ=WEEKLY;COUNT=4'})]);
 const op=uuid();const p={original_date:'2026-11-09',title:'Reunião especial',status:'completed'};
 const done=await db.rpc(ana,'apply_event_op',[op,'exception_upsert',id,p]);assert.equal(done.status,'ok',JSON.stringify(done));assert.equal(done.exception.status,'completed');
 assert.equal((await db.rpc(ana,'apply_event_op',[op,'exception_upsert',id,p])).replayed,true);
 const list=(await db.as(ana,'select * from public.list_events(null,$1,$2)',['2026-01-01','2027-01-01'])).rows;
 assert.equal(list.find(e=>e.id===id).status,'planned');assert.equal(list.find(e=>e.id===id).exceptions[0].status,'completed');
 const edit=await db.rpc(ana,'apply_event_op',[uuid(),'exception_upsert',id,{original_date:'2026-11-09',title:'Título novo'}]);assert.equal(edit.exception.status,'completed');
 const denied=await db.rpc(davi,'apply_event_op',[uuid(),'exception_upsert',id,{...p,status:'planned'}]);assert.notEqual(denied.status,'ok');
 }finally{await db.close();}
});
