import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function evaluate(name,context,args=[]){const lines=source.split(/\r?\n/),i=lines.findIndex(line=>line.startsWith('function '+name+'('));assert.notEqual(i,-1,'function '+name+' exists');let code=lines[i];if(name==='calc'){const start=source.indexOf('function calc(){'),end=source.indexOf('\n/* ---- vistas ---- */',start);code=source.slice(start,end)}vm.runInNewContext(code+'\nglobalThis.result='+name+'(...globalThis.args);',Object.assign(context,{args}));return context.result}
const sample=[
 {type:'ingreso',amount:100000,status:'recibido',date:'2026-10-02',cat:'Trabajo'},
 {type:'gasto',amount:40000,status:'pagado',date:'2026-10-03',cat:'Alimentación'},
 {type:'devolucion',amount:10000,status:'recibido',date:'2026-10-05',cat:'Alimentación'},
 {type:'transferencia',amount:25000,status:'recibido',date:'2026-10-06',cat:'Otros'},
 {type:'pago_tarjeta',amount:15000,status:'pagado',date:'2026-10-07',cat:'Otros'},
 {type:'anulada',amount:8000,status:'recibido',date:'2026-10-08',cat:'Otros'},
 {type:'gasto',amount:9000,status:'pendiente',date:'2026-10-09',cat:'Hogar'},
];
test('los informes netean reintegros y excluyen movimientos neutrales',()=>{const ctx={S:{tx:sample},mes:d=>d.slice(0,7)};const result=evaluate('reportTotals',ctx,['2026-10']);assert.equal(result.inc,100000);assert.equal(result.grossGas,40000);assert.equal(result.refunds,10000);assert.equal(result.gas,30000);assert.equal(result.pending,1)});
test('las categorías del informe reducen la categoría del reintegro',()=>{const ctx={S:{tx:sample},mes:d=>d.slice(0,7)};const result=evaluate('expenseCategories',ctx,['2026-10']);assert.deepEqual({...result},{'Alimentación':30000})});
test('el presupuesto usa gasto pagado menos reintegros de la categoría',()=>{const ctx={S:{tx:sample},mes:d=>d.slice(0,7)};const result=evaluate('monthlyCategorySpend',ctx,['Alimentación','2026-10']);assert.equal(result,30000)});
test('el saldo reconoce reintegros y omite transferencias, pagos de tarjeta y anulaciones',()=>{const ctx={S:{tx:sample,goals:[]},mes:d=>d.slice(0,7),hoy:()=> '2026-10-28'};const result=evaluate('calc',ctx,[]);assert.equal(result.bal,70000);assert.equal(result.ing,100000);assert.equal(result.gas,30000);assert.equal(result.pGas,9000)});
test('una devolución superior al gasto no produce categoría negativa',()=>{const rows=[{type:'gasto',amount:50,status:'pagado',date:'2026-10-01',cat:'Hogar'},{type:'devolucion',amount:100,status:'recibido',date:'2026-10-02',cat:'Hogar'}];const ctx={S:{tx:rows},mes:d=>d.slice(0,7)};const result=evaluate('expenseCategories',ctx,['2026-10']);assert.deepEqual({...result},{})});
