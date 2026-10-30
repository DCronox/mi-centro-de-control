import { matchPossibleDuplicates, parseNuStatementText, pdfErrorMessage } from './nu-pdf-import.mjs';
import { readPdfDocument } from './nu-pdf-reader.mjs';

const PDFJS_VERSION='6.4.299';
const PDFJS_BASE='https://cdn.jsdelivr.net/npm/pdfjs-dist@'+PDFJS_VERSION+'/';
const TYPES=[
  ['gasto','Gasto'],['ingreso','Ingreso'],['devolucion','Devolución'],['transferencia','Transferencia propia'],
  ['pago_tarjeta','Pago de tarjeta'],['anulada','Anulada o reversada'],['por_revisar','Por clasificar'],
];
const CATEGORIES=['Alimentación','Transporte','Universidad','Gimnasio','Hogar','Entretenimiento','Salud','Compras personales','Suscripciones','Trabajo','Otros'];
let pdfjsPromise=null,draft=null,statusText='Los extractos se procesan en este dispositivo. El PDF no se sube ni se guarda.',statusStage='idle',working=false,currentTask=null;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=n=>'$'+Math.round(Number(n)||0).toLocaleString('es-CO')+' COP';
const bytesText=n=>n<1024*1024?Math.ceil(n/1024)+' KB':(n/1024/1024).toFixed(1)+' MB';
const uid=()=>globalThis.crypto?.randomUUID?.()||('nu-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));

function setStatus(text,stage='processing'){statusText=text;statusStage=stage;const node=document.getElementById('nuImportStatus');if(node){node.textContent=text;node.dataset.stage=stage;node.className='report-note nu-status nu-status-'+stage}}
function typesOptions(value){return TYPES.map(([v,label])=>'<option value="'+v+'" '+(v===value?'selected':'')+'>'+label+'</option>').join('')}
function totals(){const t={gasto:0,ingreso:0,devolucion:0,neutral:0,selected:0};for(const c of draft?.movements||[]){if(!c.selected)continue;t.selected++;if(c.type==='gasto'||c.type==='ingreso'||c.type==='devolucion')t[c.type]+=Number(c.amount)||0;else t.neutral++}return t}
function duplicateLabel(c){if(!c.duplicates?.length)return'';const names=c.duplicates.slice(0,2).map(d=>d.name).filter(Boolean).join(', ');return '<div class="nu-duplicate" role="status">'+(c.duplicates.some(d=>d.exact)?'Coincide con una referencia importada':'Posible duplicado; compara con')+(names?': '+esc(names):'')+'. Decide si lo incluyes.</div>'}
function reviewHtml(){
  if(!draft)return'';
  const sums=totals(),rows=draft.movements.map((c,i)=>'<article class="nu-review-row '+(c.selected?'selected':'')+'"><div class="nu-review-select"><label><input type="checkbox" data-nu-field="selected" data-index="'+i+'" '+(c.selected?'checked':'')+'> Importar este movimiento</label><b>'+esc(Math.round(c.confidence*100))+'% confianza</b></div><label class="fl">Fecha<input type="date" data-nu-field="date" data-index="'+i+'" value="'+esc(c.date||'')+'" required></label><label class="fl nu-description">Descripción<input type="text" maxlength="120" data-nu-field="description" data-index="'+i+'" value="'+esc(c.description||'')+'" required></label><label class="fl">Valor (COP)<input type="number" min="0.01" step="0.01" inputmode="decimal" data-nu-field="amount" data-index="'+i+'" value="'+(Number.isFinite(Number(c.amount))&&c.amount!==null?esc(c.amount):'')+'" required></label><label class="fl">Tipo<select data-nu-field="type" data-index="'+i+'">'+typesOptions(c.type)+'</select></label><label class="fl">Categoría<input type="text" maxlength="60" list="nuImportCategories" data-nu-field="category" data-index="'+i+'" value="'+esc(c.category||'Otros')+'"></label><div class="nu-review-notes">'+(c.warnings||[]).map(w=>'<p class="warn">'+esc(w)+'</p>').join('')+duplicateLabel(c)+(c.bankReference?'<small>Referencia: '+esc(c.bankReference)+'</small>':'')+'</div></article>').join('');
  const selectedValid=draft.movements.some(c=>canConfirm([c]));
  return '<section class="nu-review"><h3>Revisa antes de guardar</h3><p class="report-note">'+draft.movements.length+' movimientos detectados. Ninguno se guarda hasta que confirmes.</p><div class="nu-import-meta"><span>Producto: '+esc(productLabel(draft.product))+'</span>'+(draft.period?'<span>Periodo: '+esc(draft.period.start||'')+(draft.period.end?' – '+esc(draft.period.end):'')+'</span>':'')+(draft.openingBalance!==null?'<span>Saldo inicial: '+fmt(draft.openingBalance)+'</span>':'')+(draft.closingBalance!==null?'<span>Saldo final: '+fmt(draft.closingBalance)+'</span>':'')+'</div><div class="nu-import-totals"><span>Incluidos: <b>'+sums.selected+'</b></span><span>Gastos: <b>'+fmt(sums.gasto)+'</b></span><span>Ingresos: <b>'+fmt(sums.ingreso)+'</b></span><span>Devoluciones: <b>'+fmt(sums.devolucion)+'</b></span><span>Movimientos neutrales: <b>'+sums.neutral+'</b></span></div><datalist id="nuImportCategories">'+[...CATEGORIES,...new Set(draft.movements.map(x=>x.category).filter(Boolean))].map(x=>'<option value="'+esc(x)+'">').join('')+'</datalist><div class="nu-review-list">'+(rows||'<div class="empty">El extracto no contiene movimientos detectables.</div>')+'</div><div class="nu-review-actions"><button class="b" type="button" data-nu-action="confirm" '+(selectedValid?'':'disabled')+'>Confirmar e importar seleccionados</button><button class="g" type="button" data-nu-action="cancel">Cancelar y descartar</button></div><p class="report-note">Las transferencias propias, pagos de tarjeta y operaciones anuladas no aumentan los ingresos ni los gastos consolidados. Las coincidencias quedan excluidas inicialmente para que las revises.</p></section>';
}
function productLabel(product){return product==='cuenta_nu'?'Cuenta Nu':product==='tarjeta_nu'?'Tarjeta de crédito Nu':'Producto Nu (por identificar)'}
function renderPanel(){
  const mount=document.getElementById('nuImportMount');if(!mount)return;
  mount.innerHTML='<section class="card nu-import-card"><h2>Importar extracto Nu</h2><p class="report-note">Selecciona un PDF de tu Cuenta Nu o tarjeta de crédito Nu. El archivo se lee en tu navegador y no se conserva.</p><div id="nuPdfDrop" class="nu-drop"><div><b>Arrastra aquí tu extracto</b><span>o selecciona un PDF de hasta 15 MB</span></div><input id="nuPdfInput" type="file" accept=".pdf,application/pdf" aria-label="Seleccionar extracto PDF de Nu" '+(working?'disabled':'')+'>'+(working?'<button class="g" type="button" data-nu-action="cancel">Cancelar lectura</button>':'<button class="g" type="button" data-nu-action="choose">Elegir PDF</button>')+'</div><p id="nuImportStatus" class="report-note nu-status nu-status-'+statusStage+'" data-stage="'+statusStage+'" role="status" aria-live="polite">'+esc(statusText)+'</p>'+(draft?'<div class="nu-file-meta">'+esc(draft.fileName)+' · '+bytesText(draft.fileSize)+' · '+draft.pageCount+' página(s) · '+draft.textLength+' caracteres de texto extraídos</div>'+reviewHtml():'')+'</section>';
}
function loadPdfJs(){
  if(!pdfjsPromise)pdfjsPromise=import(PDFJS_BASE+'build/pdf.mjs').then(lib=>{
    lib.GlobalWorkerOptions.workerSrc=PDFJS_BASE+'build/pdf.worker.mjs';return lib;
  }).catch(error=>{pdfjsPromise=null;const detail=location.protocol==='file:'?'La importación de PDF requiere abrir la aplicación desde una dirección HTTPS o localhost. Esta copia se abrió como archivo local y el navegador bloqueó el módulo lector por seguridad.':'No se pudo descargar el lector PDF. Comprueba tu conexión a internet e inténtalo de nuevo.';throw new Error(detail,{cause:error})});
  return pdfjsPromise;
}
function cancellationError(){const e=new Error('cancelled');e.name='ImportCancelled';return e}
async function readPdf(file){
  const task={cancelled:false,loadingTask:null};currentTask=task;
  return readPdfDocument(file,loadPdfJs,{isCancelled:()=>task.cancelled,onStatus:text=>setStatus(text,'processing'),onLoadingTask:loadingTask=>{task.loadingTask=loadingTask;loadingTask.onProgress=progress=>{if(!task.cancelled&&progress.total)setStatus('Descargando el PDF para lectura local… '+Math.round(progress.loaded/progress.total*100)+'%','processing')}},getDocumentOptions:{cMapUrl:PDFJS_BASE+'cmaps/',cMapPacked:true,standardFontDataUrl:PDFJS_BASE+'standard_fonts/'}});
}
function mapDuplicates(result){
  const existing=window.MCC_IMPORT?.getTransactions?.()||[];
  result.movements.forEach(c=>{
    c.duplicates=matchPossibleDuplicates(c,existing,result.product);
    if(c.duplicates.length)c.selected=false;
  });
}
async function processFile(file){
  if(working)return;
  draft=null;working=true;setStatus('Archivo seleccionado: '+file.name+' ('+bytesText(file.size)+'). Preparando lectura…','selected');renderPanel();
  try{
    const parsed=await readPdf(file);
    if(currentTask?.cancelled)throw cancellationError();
    setStatus('Texto extraído. Analizando formato Nu y movimientos…','processing');
    const result=parseNuStatementText(parsed.lines);
    if(!result.compatible)throw new Error(result.warnings.join(' '));
    if(result.product==='producto_nu_no_identificado')result.warnings.push('No se pudo identificar si es cuenta o tarjeta. Revisa cada tipo de movimiento.');
    mapDuplicates(result);
    draft={...result,fileName:file.name,fileSize:file.size,pageCount:parsed.pageCount,textLength:parsed.textLength,movements:result.movements.map(x=>({...x}))};
    if(result.movements.length)setStatus(result.movements.length+' movimiento(s) detectado(s). Revisión necesaria antes de guardar.','review');
    else setStatus('El PDF se abrió y se extrajeron '+parsed.textLength+' caracteres, pero el analizador no encontró movimientos con fecha e importe. Revisa que sea un extracto Nu Colombia con texto seleccionable; no se guardó nada.','empty');
  }catch(error){
    if(error?.name==='ImportCancelled')setStatus('Lectura cancelada. No se guardaron cambios.','idle');
    else setStatus(error?.message?.startsWith('El archivo')||error?.message?.startsWith('El PDF')||error?.message?.startsWith('Este PDF')||error?.message?.startsWith('La app')||error?.message?.startsWith('La importación')||error?.message?.startsWith('No se pudo descargar')?error.message:pdfErrorMessage(error),'error');
  }finally{working=false;currentTask=null;renderPanel()}
}
function updateCandidate(input){
  const i=Number(input.dataset.index),field=input.dataset.nuField,c=draft?.movements[i];if(!c)return;
  if(field==='selected')c.selected=input.checked;
  else if(field==='amount')c.amount=input.value===''?null:Number(input.value);
  else c[field]=input.value;
  renderPanel();
}
function canConfirm(rows){return rows.length>0&&rows.every(c=>c.selected&&c.date&&/^\d{4}-\d{2}-\d{2}$/.test(c.date)&&c.description?.trim()&&Number.isFinite(Number(c.amount))&&Number(c.amount)>0&&c.type!=='por_revisar'&&TYPES.some(([v])=>v===c.type))}
function confirmImport(){
  if(!draft||working)return;
  const selected=draft.movements.filter(c=>c.selected);
  if(!canConfirm(selected)){setStatus('Revisión necesaria: corrige fechas, descripciones, montos y tipos de los movimientos seleccionados.','review');renderPanel();return}
  working=true;setStatus('Guardando '+selected.length+' movimiento(s) en los datos de esta app…','processing');renderPanel();const batch=uid(),product=draft.product,rows=selected.map(c=>({id:uid(),type:c.type,name:c.description.trim(),amount:Math.round(Number(c.amount)*100)/100,date:c.date,cat:(c.category||'Otros').trim()||'Otros',method:'Nu',status:c.status||((c.type==='gasto'||c.type==='pago_tarjeta')?'pagado':'recibido'),importedFrom:'nu-pdf',nuProduct:product,importBatchId:batch,bankReference:(c.bankReference||'').trim()||undefined}));
  try{
    const result=window.MCC_IMPORT?.commit?.(rows);
    if(!result?.ok)throw new Error(result?.message||'No se pudieron guardar los movimientos. La copia local anterior permanece intacta.');
    draft=null;setStatus('Importación exitosa: '+rows.length+' movimientos incorporados. El PDF no se guardó.','success');
  }catch(error){setStatus(error.message||'Error: no se pudieron guardar los movimientos; tus datos anteriores permanecen intactos.','error')}
  finally{working=false;renderPanel()}
}
function cancelImport(){
  if(currentTask){currentTask.cancelled=true;try{currentTask.loadingTask?.destroy()?.catch(()=>{})}catch{}setStatus('Cancelando lectura…','processing');renderPanel();return}
  draft=null;working=false;setStatus('Importación cancelada. No se guardaron cambios.','idle');
  const input=document.getElementById('nuPdfInput');if(input)input.value='';
  renderPanel();
}
document.addEventListener('mcc:rendered',renderPanel);
document.addEventListener('click',event=>{
  const action=event.target.closest('[data-nu-action]')?.dataset.nuAction;if(!action)return;
  if(action==='choose')document.getElementById('nuPdfInput')?.click();
  if(action==='cancel')cancelImport();
  if(action==='confirm')confirmImport();
});
document.addEventListener('change',event=>{
  if(event.target?.id==='nuPdfInput'){const file=event.target.files?.[0];if(file)processFile(file);return}
  if(event.target?.matches('[data-nu-field][data-index]'))updateCandidate(event.target);
});
document.addEventListener('dragover',event=>{const drop=event.target.closest('#nuPdfDrop');if(drop){event.preventDefault();drop.classList.add('dragging')}});
document.addEventListener('dragleave',event=>{const drop=event.target.closest('#nuPdfDrop');if(drop&&!drop.contains(event.relatedTarget))drop.classList.remove('dragging')});
document.addEventListener('drop',event=>{const drop=event.target.closest('#nuPdfDrop');if(!drop)return;event.preventDefault();drop.classList.remove('dragging');const file=event.dataTransfer?.files?.[0];if(file)processFile(file)});
renderPanel();

