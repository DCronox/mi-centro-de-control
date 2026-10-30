import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const a=src.indexOf('function mergeData('),b=src.indexOf('function softRender');
const ctx={defaultData:()=>({tx:[],goals:[],routines:[],inst:{},budgets:[],obligations:[],scheduledShifts:[],rate:13000,shifts:[]})};
vm.createContext(ctx);vm.runInContext(src.slice(a,b)+';this.mergeData=mergeData',ctx);
const D=o=>Object.assign(ctx.defaultData(),o);
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
