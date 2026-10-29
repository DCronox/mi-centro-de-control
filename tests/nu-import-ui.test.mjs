import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { pdfErrorMessage } from '../nu-pdf-import.mjs';

const source = fs.readFileSync(new URL('../nu-import-ui.mjs', import.meta.url), 'utf8');
const canConfirm = source.split(/\r?\n/).find(line => line.startsWith('function canConfirm('));
assert.ok(canConfirm, 'canConfirm existe');
const processFile = source.slice(source.indexOf('async function processFile('), source.indexOf('\nfunction updateCandidate('));
const confirmImport = source.slice(source.indexOf('function confirmImport(){'), source.indexOf('\nfunction cancelImport(){'));

function valid(rows) {
  const context = { TYPES: [['gasto'], ['ingreso'], ['devolucion'], ['transferencia'], ['pago_tarjeta'], ['anulada'], ['por_revisar']] };
  vm.runInNewContext(`${canConfirm}\nglobalThis.result=canConfirm(globalThis.rows);`, Object.assign(context, { rows }));
  return context.result;
}

test('la fecha ISO válida habilita confirmar e importar', () => {
  assert.equal(valid([{ selected: true, date: '2026-10-28', description: 'Compra', amount: 12500, type: 'gasto' }]), true);
});

test('no se puede confirmar una fecha inválida, un movimiento sin selección o por revisar', () => {
  assert.equal(valid([{ selected: true, date: '28/10/2026', description: 'Compra', amount: 12500, type: 'gasto' }]), false);
  assert.equal(valid([{ selected: false, date: '2026-10-28', description: 'Compra', amount: 12500, type: 'gasto' }]), false);
  assert.equal(valid([{ selected: true, date: '2026-10-28', description: 'Movimiento', amount: 12500, type: 'por_revisar' }]), false);
});

async function runProcess({parsed={lines:['Cuenta Nu'],pageCount:1,textLength:80},result={compatible:true,product:'cuenta_nu',movements:[{date:'2026-10-01',description:'Compra',amount:1000,type:'gasto',category:'Otros',selected:true,confidence:.9}]},readError=null}={}){
  const stages=[],context={working:false,draft:null,currentTask:{cancelled:false},statusText:'',statusStage:'idle',file:{name:'prueba.pdf',size:100},
    bytesText:n=>n+' bytes',renderPanel(){},mapDuplicates(){},pdfErrorMessage,
    setStatus(text,stage='processing'){context.statusText=text;context.statusStage=stage;stages.push(stage)},
    async readPdf(){if(readError)throw readError;return parsed},parseNuStatementText(){return result},cancellationError(){const e=new Error('cancel');e.name='ImportCancelled';return e},stages};
  vm.runInNewContext(`'use strict';${processFile}\nglobalThis.done=processFile(globalThis.file);`,context);
  await context.done;
  return context;
}

test('seleccionar archivo actualiza estados, analiza y deja movimientos en revisión',async()=>{
  const context=await runProcess();
  assert.deepEqual(context.stages,['selected','processing','review']);
  assert.equal(context.draft.movements.length,1);
  assert.equal(context.working,false);
  assert.match(context.statusText,/Revisión necesaria/);
});

test('un PDF válido sin movimientos muestra estado vacío con explicación',async()=>{
  const context=await runProcess({result:{compatible:true,product:'cuenta_nu',movements:[]},parsed:{lines:['Extracto Cuenta Nu'],pageCount:1,textLength:35}});
  assert.equal(context.statusStage,'empty');
  assert.match(context.statusText,/no encontró movimientos/i);
  assert.match(context.statusText,/no se guardó nada/i);
  assert.equal(context.draft.movements.length,0);
});

test('los errores de lectura se exponen en pantalla y liberan el estado de trabajo',async()=>{
  const passwordError=Object.assign(new Error('No password given'),{name:'PasswordException',code:1});
  const context=await runProcess({readError:passwordError});
  assert.equal(context.statusStage,'error');
  assert.match(context.statusText,/protegido con contraseña/i);
  assert.equal(context.working,false);
});

test('confirmar guarda solo movimientos válidos y comunica éxito',()=>{
  const saved=[],context={working:false,draft:{product:'cuenta_nu',movements:[{selected:true,date:'2026-10-01',description:'Compra D1',amount:12500.4,type:'gasto',category:'Alimentación'}]},
    TYPES:[['gasto'],['ingreso'],['devolucion'],['transferencia'],['pago_tarjeta'],['anulada'],['por_revisar']],uid:(()=>{let n=0;return()=>`id-${++n}`})(),renderPanel(){},
    setStatus(text,stage){context.statusText=text;context.statusStage=stage},window:{MCC_IMPORT:{commit(rows){saved.push(...rows);return{ok:true}}}}};
  vm.runInNewContext(`'use strict';${canConfirm}\n${confirmImport}\nconfirmImport();`,context);
  assert.equal(saved.length,1);
  assert.equal(saved[0].amount,12500.4);
  assert.equal(saved[0].importedFrom,'nu-pdf');
  assert.equal(context.draft,null);
  assert.equal(context.statusStage,'success');
  assert.match(context.statusText,/Importación exitosa/);
});

test('un fallo al guardar conserva el borrador para corregir o reintentar',()=>{
  const context={working:false,draft:{product:'cuenta_nu',movements:[{selected:true,date:'2026-10-01',description:'Compra',amount:12500,type:'gasto',category:'Otros'}]},
    TYPES:[['gasto'],['ingreso'],['devolucion'],['transferencia'],['pago_tarjeta'],['anulada'],['por_revisar']],uid:()=> 'id-1',renderPanel(){},setStatus(text,stage){context.statusText=text;context.statusStage=stage},window:{MCC_IMPORT:{commit(){return{ok:false,message:'No se pudo guardar localmente.'}}}}};
  vm.runInNewContext(`'use strict';${canConfirm}\n${confirmImport}\nconfirmImport();`,context);
  assert.ok(context.draft);
  assert.equal(context.statusStage,'error');
  assert.match(context.statusText,/No se pudo guardar localmente/);
});
