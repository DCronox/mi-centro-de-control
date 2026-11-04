import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Carga el modelo de sincronización tal como lo usa la app.
const model=fs.readFileSync(new URL('../js/sync-model.js',import.meta.url),'utf8');
const ctx={};
vm.createContext(ctx);
vm.runInContext(model+';this.mergeData=mergeData;this.trackChanges=trackChanges;this.syncSnapshot=syncSnapshot;this.defaultData=defaultData;this.normalizeData=normalizeData',ctx);
const D=o=>Object.assign(ctx.defaultData(),o);
const clone=o=>JSON.parse(JSON.stringify(o));

test('une movimientos de dos dispositivos sin perder ninguno',()=>{
  const m=ctx.mergeData(D({tx:[{id:'a'},{id:'b'}]}),D({tx:[{id:'b'},{id:'c'}]}));
  assert.equal(m.tx.map(t=>t.id).sort().join(),'a,b,c');
});
test('tarea generada por rutina no se duplica y conserva la marcada como hecha',()=>{
  const r=D({inst:{'2026-10-30':[{id:'x',rid:'r1',date:'2026-10-30',done:true}]}}),l=D({inst:{'2026-10-30':[{id:'y',rid:'r1',date:'2026-10-30'}]}});
  const m=ctx.mergeData(r,l);assert.equal(m.inst['2026-10-30'].length,1);assert.equal(m.inst['2026-10-30'][0].done,true);
});
test('obligación mensual no genera dos gastos',()=>{
  const m=ctx.mergeData(D({tx:[{id:'1',obligationId:'o',obligationMonth:'2026-10'}]}),D({tx:[{id:'2',obligationId:'o',obligationMonth:'2026-10'}]}));
  assert.equal(m.tx.length,1);
});
test('la tarifa de este dispositivo prevalece',()=>{assert.equal(ctx.mergeData(D({rate:10000}),D({rate:15000})).rate,15000)});

test('un borrado en un dispositivo no reaparece al unir con otro que aún tenía el elemento',()=>{
  const base=D({tx:[{id:'a',name:'Café'},{id:'b',name:'Bus'}]});
  // Dispositivo A borra «a»
  const A=clone(base);let snap=ctx.syncSnapshot(A);A.tx=A.tx.filter(t=>t.id!=='a');ctx.trackChanges(A,snap,1000);
  assert.ok(A.deleted['tx|id:a'],'queda una lápida');
  // Dispositivo B sigue con la copia vieja y agrega «c»
  const B=clone(base);snap=ctx.syncSnapshot(B);B.tx.push({id:'c',name:'Pan'});ctx.trackChanges(B,snap,1100);
  const m=ctx.mergeData(A,B);
  assert.deepEqual([...m.tx.map(t=>t.id).sort()],['b','c']);
  assert.deepEqual([...ctx.mergeData(B,A).tx.map(t=>t.id).sort()],['b','c'],'el orden de la unión no importa');
});
test('gana la edición más reciente del mismo elemento',()=>{
  const base=D({tx:[{id:'a',status:'pendiente'}]});
  const A=clone(base);let s=ctx.syncSnapshot(A);A.tx[0].status='pagado';ctx.trackChanges(A,s,2000);
  const B=clone(base);s=ctx.syncSnapshot(B);B.tx[0].name='Arriendo';ctx.trackChanges(B,s,1000);
  assert.equal(ctx.mergeData(A,B).tx[0].status,'pagado');
  assert.equal(ctx.mergeData(B,A).tx[0].status,'pagado');
});
test('los aportes a una meta hechos en dos dispositivos se conservan todos',()=>{
  const base=ctx.normalizeData(D({goals:[{id:'g',name:'Moto',target:1000,monthly:0,aportes:[{amount:100,date:'2026-10-01'}]}]}));
  const A=clone(base);let s=ctx.syncSnapshot(A);A.goals[0].aportes.push({id:'x1',amount:50,date:'2026-10-05'});ctx.trackChanges(A,s,1000);
  const B=clone(base);s=ctx.syncSnapshot(B);B.goals[0].aportes.push({id:'y1',amount:70,date:'2026-10-06'});ctx.trackChanges(B,s,1100);
  const m=ctx.mergeData(A,B);
  assert.equal(m.goals.length,1);
  assert.deepEqual([...m.goals[0].aportes.map(a=>a.amount)],[100,50,70]);
});
test('los aportes antiguos sin id reciben el mismo id en todos los dispositivos',()=>{
  const raw={goals:[{id:'g',aportes:[{amount:10,date:'2026-01-01'},{amount:10,date:'2026-01-01'}]}]};
  const a=ctx.normalizeData(D(clone(raw))),b=ctx.normalizeData(D(clone(raw)));
  assert.deepEqual([...a.goals[0].aportes.map(x=>x.id)],[...b.goals[0].aportes.map(x=>x.id)]);
  assert.notEqual(a.goals[0].aportes[0].id,a.goals[0].aportes[1].id);
  assert.equal(ctx.mergeData(a,b).goals[0].aportes.length,2,'no se duplican');
});
test('un elemento restaurado después de borrarlo sobrevive a la lápida',()=>{
  const A=D({tx:[],deleted:{'tx|id:a':1000}});
  const B=D({tx:[{id:'a',u:2000}]});
  assert.equal(ctx.mergeData(A,B).tx.length,1);
});
test('borrar una tarea del día deja lápida y no vuelve',()=>{
  const base=D({inst:{'2026-10-30':[{id:'t1',date:'2026-10-30',name:'Leer'}]}});
  const A=clone(base);const s=ctx.syncSnapshot(A);A.inst['2026-10-30']=[];ctx.trackChanges(A,s,5000);
  assert.equal(ctx.mergeData(base,A).inst['2026-10-30'].length,0);
});
test('datos antiguos sin lápidas ni marcas siguen uniéndose igual que antes',()=>{
  const m=ctx.mergeData({tx:[{id:'a'}],goals:[],routines:[],inst:{},shifts:[]},{tx:[{id:'b'}],goals:[],routines:[],inst:{},shifts:[]});
  assert.equal(m.tx.length,2);assert.deepEqual({...m.deleted},{});
});
test('un aporte borrado en un dispositivo no vuelve al unir la meta',()=>{
  const base=ctx.normalizeData(D({goals:[{id:'g',name:'Moto',target:1000,aportes:[{id:'a1',amount:100,date:'2026-10-01'},{id:'a2',amount:50,date:'2026-10-02'}]}]}));
  const A=clone(base);let s=ctx.syncSnapshot(A);A.goals[0].aportes=A.goals[0].aportes.filter(a=>a.id!=='a2');ctx.trackChanges(A,s,3000);
  assert.ok(A.deleted['goal.aportes|g|id:a2']);
  const B=clone(base);s=ctx.syncSnapshot(B);B.goals[0].aportes.push({id:'a3',amount:20,date:'2026-10-03'});ctx.trackChanges(B,s,3100);
  assert.deepEqual([...ctx.mergeData(A,B).goals[0].aportes.map(a=>a.id)],['a1','a3']);
  assert.deepEqual([...ctx.mergeData(B,A).goals[0].aportes.map(a=>a.id)],['a1','a3']);
});
test('los avances de una meta personal se unen igual que los aportes',()=>{
  const base=D({goals:[{id:'p',kind:'personal',name:'Leer',target:12,aportes:[],progress:[]}]});
  const A=clone(base);let s=ctx.syncSnapshot(A);A.goals[0].progress.push({id:'x',amount:1,date:'2026-10-01'});ctx.trackChanges(A,s,1000);
  const B=clone(base);s=ctx.syncSnapshot(B);B.goals[0].progress.push({id:'y',amount:2,date:'2026-10-02'});ctx.trackChanges(B,s,1001);
  assert.equal(ctx.mergeData(A,B).goals[0].progress.length,2);
});
test('el turno en curso más reciente prevalece al unir',()=>{
  const A=D({activeShift:{on:false,u:500}}),B=D({activeShift:{on:true,in:'17:00',u:400}});
  assert.equal(ctx.mergeData(A,B).activeShift.on,false);
  assert.equal(ctx.mergeData(B,A).activeShift.on,false);
});
test('las preferencias de notificaciones más recientes prevalecen al unir',()=>{
  const A=D({notifPrefs:{enabled:false,u:900}}),B=D({notifPrefs:{enabled:true,u:100}});
  assert.equal(ctx.mergeData(A,B).notifPrefs.enabled,false);
  assert.equal(ctx.mergeData(B,A).notifPrefs.enabled,false);
});
