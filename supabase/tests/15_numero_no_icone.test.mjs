import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setupGroup} from './helpers/scenario.mjs';
import {uuid} from './helpers/db.mjs';

// O número no ícone conta o mesmo que a visão "Hoje" da aba Tarefas e só o
// que cada pessoa enxerga.
test('número no ícone: pendentes de hoje, atrasadas e planejadas, sem vazar tarefas alheias',async()=>{
 const {db,ana,bruno,fabio,cal}=await setupGroup();try{
 const hoje='2026-11-17';
 const count=async u=>(await db.admin('select private.badge_count($1,$2::date) as n',[u,hoje])).rows[0].n;
 const criar=(u,p)=>db.rpc(u,'apply_item_op',[uuid(),'task','create',uuid(),p,null,'app']);
 await criar(ana,{title:'Hoje',due_date:hoje});
 await criar(ana,{title:'Atrasada',due_date:'2026-11-10'});
 await criar(ana,{item_type:'reminder',title:'Lembrete de hoje',due_date:hoje});
 await criar(ana,{title:'Amanhã',due_date:'2026-11-18'});
 await criar(ana,{title:'Sem data'});
 const feita=uuid();await db.rpc(ana,'apply_item_op',[uuid(),'task','create',feita,{title:'Feita',due_date:hoje},null,'app']);
 await db.rpc(ana,'apply_item_op',[uuid(),'task','complete',feita,{},null,'app']);
 const planejada=uuid();await db.rpc(ana,'apply_item_op',[uuid(),'task','create',planejada,{title:'Planejada',due_date:'2026-11-25'},null,'app']);
 await db.rpc(ana,'apply_item_op',[uuid(),'task','plan_set',planejada,{day:hoje},null,'app']);
 assert.equal(await count(ana),4,'hoje, atrasada, lembrete e planejada');
 // Tarefa da agenda: conta para quem enxerga; a pessoal de Ana não conta para Bruno.
 await criar(ana,{title:'Da casa',calendar_id:cal,privacy:'members',due_date:hoje});
 assert.equal(await count(ana),5);
 assert.equal(await count(bruno),1);
 assert.equal(await count(fabio),0,'quem não é da agenda não vê nada');
 const lixeira=uuid();await db.rpc(ana,'apply_item_op',[uuid(),'task','create',lixeira,{title:'Apagada',due_date:hoje},null,'app']);
 await db.rpc(ana,'apply_item_op',[uuid(),'task','delete',lixeira,{},null,'app']);
 assert.equal(await count(ana),5,'tarefa na lixeira não conta');
 // Ninguém chama a função direto pelo app.
 await assert.rejects(db.as(bruno,'select private.badge_count($1,$2::date)',[ana,hoje]));
 }finally{await db.close()}
});
