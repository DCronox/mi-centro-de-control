import test from 'node:test';
import assert from 'node:assert/strict';
import { readPdfDocument } from '../nu-pdf-reader.mjs';
import { parseNuStatementText } from '../nu-pdf-import.mjs';

const statementLines = [
  'NU Colombia Cuenta de ahorros - Extracto',
  'Periodo 01/10/2026 - 31/10/2026',
  '01/10/2026 Compra Mercado D1 -$ 25.000,00',
  '02/10/2026 Nomina Empresa ACME $ 2.500.000,00',
];
const items = statementLines.flatMap((str,index)=>[{str,transform:[1,0,0,1,24,740-index*18]}]);
const pdfFile = (bytes='%PDF-1.7\n') => new Blob([bytes]);

function fakePdfjs({pages=[items],error=null}={}){
  let destroyed=false,seenOptions=null;
  const doc={numPages:pages.length,getPage:async n=>({getTextContent:async()=>{if(error)throw error;return{items:pages[n-1]}},cleanup(){}}),async destroy(){destroyed=true}};
  return{getDocument(options){seenOptions=options;return{promise:error?Promise.reject(error):Promise.resolve(doc)}},get destroyed(){return destroyed},get options(){return seenOptions}};
}

test('lee un PDF y conecta el texto extraído con el analizador de extractos Nu',async()=>{
  const pdfjs=fakePdfjs(),stages=[];
  const result=await readPdfDocument(pdfFile(),async()=>pdfjs,{onStatus:s=>stages.push(s)});
  const parsed=parseNuStatementText(result.lines);
  assert.equal(result.pageCount,1);
  assert.ok(result.textLength>20);
  assert.equal(parsed.compatible,true);
  assert.equal(parsed.product,'cuenta_nu');
  assert.equal(parsed.movements.length,2);
  assert.ok(stages.some(s=>s.includes('Validando')));
  assert.ok(stages.some(s=>s.includes('Extrayendo texto')));
  assert.equal(pdfjs.destroyed,true);
});

test('rechaza extensión falsa o contenido que no empieza con cabecera PDF antes de cargar la librería',async()=>{
  let loads=0;
  await assert.rejects(readPdfDocument(pdfFile('esto no es pdf'),async()=>{loads++}),/cabecera PDF válida/i);
  assert.equal(loads,0);
});

test('distingue un PDF escaneado sin texto seleccionable y libera el documento',async()=>{
  const pdfjs=fakePdfjs({pages:[[{str:' '},{str:'',transform:[1,0,0,1,0,0]}]]});
  await assert.rejects(readPdfDocument(pdfFile(),async()=>pdfjs),/no contiene texto seleccionable.*no ejecuta OCR/i);
  assert.equal(pdfjs.destroyed,true);
});

test('propaga errores de contraseña de PDF.js sin solicitar ni probar contraseñas',async()=>{
  const passwordError=Object.assign(new Error('No password given'),{name:'PasswordException',code:1});
  const pdfjs=fakePdfjs({error:passwordError});
  await assert.rejects(readPdfDocument(pdfFile(),async()=>pdfjs),error=>error.name==='PasswordException');
});

test('rechaza extractos que exceden el máximo de páginas y destruye el documento',async()=>{
  const pdfjs=fakePdfjs({pages:Array.from({length:61},()=>items)});
  await assert.rejects(readPdfDocument(pdfFile(),async()=>pdfjs),/más de 60 páginas/i);
  assert.equal(pdfjs.destroyed,true);
});
