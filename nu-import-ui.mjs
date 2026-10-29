import {
  MAX_PDF_BYTES, MAX_PDF_PAGES, matchPossibleDuplicates, parseNuStatementText,
  pdfErrorMessage, pdfItemsToLines,
} from './nu-pdf-import.mjs';

const PDFJS_VERSION='6.4.299';
const PDFJS_BASE='https://cdn.jsdelivr.net/npm/pdfjs-dist@'+PDFJS_VERSION+'/';
const TYPES=[
  ['gasto','Gasto'],['ingreso','Ingreso'],['devolucion','Devolución'],['transferencia','Transferencia propia'],
  ['pago_tarjeta','Pago de tarjeta'],['anulada','Anulada o reversada'],['por_revisar','Por clasificar'],
];
const CATEGORIES=['Alimentación','Transporte','Universidad','Gimnasio','Hogar','Entretenimiento','Salud','Compras personales','Suscripciones','Trabajo','Otros'];
let pdfjsPromise=null,draft=null,statusText='Los extractos se procesan en este dispositivo. El PDF no se sube ni se guarda.',statusError=false,working=false,currentTask=null;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=n=>'$'+Math.round(Number(n)||0).toLocaleString('es-CO')+' COP';
const bytesText=n=>n<1024*1024?Math.ceil(n/1024)+' KB':(n/1024/1024).toFixed(1)+' MB';
const uid=()=>globalThis.crypto?.randomUUID?.()||('nu-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));

function setStatus(text,error=false){statusText=text;statusError=error;const node=document.getElementById('nuImportStatus');if(node){node.textContent=text;node.classList.toggle('bad',error);node.classList.toggle('ok',!error)}}
function typesOptions(value){return TYPES.map(([v,label])=>'<option value="'+v+'" '+(v===value?'selected':'')+'>'+label+'</option>').join('')}
function totals(){const t={gasto:0,ingreso:0,devolucion:0,neutral:0,selected:0};for(const c of draft?.movements||[]){if(!c.selected)continue;t.selected++;if(c.type==='gasto'||c.type==='ingreso'||c.type==='devolucion')t[c.type]+=Number(c.amount)||0;else t.neutral++}return t}
function duplicateLabel(c){if(!c.duplicates?.length)return'';const names=c.duplicates.slice(0,2).map(d=>d.name).filter(Boolean).join(', ');return '<div class="nu-duplicate" role="status">'+(c.duplicates.some(d=>d.exact)?'Coincide con una referencia importada':'Posible duplicado; compara con')+(names?': '+esc(names):'')+'. Decide si lo incluyes.</div>'}
function reviewHtml(){
  if(!draft)return'';
  const sums=totals(),rows=draft.movements.map((c,i)=>'<article class="nu-review-row '+(c.selected?'selected':'')+'"><div class="nu-review-select"><label><input type="checkbox" data-nu-field="selected" data-index="'+i+'" '+(c.selected?'checked':'')+'> Importar este movimiento</label><b>'+esc(Math.round(c.confidence*100))+'% confianza</b></div><label class="fl">Fecha<input type="date" data-nu-field="date" data-index="'+i+'" value="'+esc(c.date||'')+'" required></label><label class="fl nu-description">Descripción<input type="text" maxlength="120" data-nu-field="description" data-index="'+i+'" value="'+esc(c.description||'')+'" required></label><label class="fl">Valor (COP)<input type="number" min="0.01" step="0.01" inputmode="decimal" data-nu-field="amount" data-index="'+i+'" value="'+(Number.isFinite(Number(c.amount))&&c.amount!==null?esc(c.amount):'')+'" required></label><label class="fl">Tipo<select data-nu-field="type" data-index="'+i+'">'+typesOptions(c.type)+'</select></label><label class="fl">Categoría<input type="text" maxlength="60" list="nuImportCategories" data-nu-field="category" data-index="'+i+'" value="'+esc(c.category||'Otros')+'"></label><div class="nu-review-notes">'+(c.warnings||[]).map(w=>'<p class="warn">'+esc(w)+'</p>').join('')+duplicateLabel(c)+(c.bankReference?'<small>Referencia: '+esc(c.bankReference)+'</small>':'')+'</div></article>').join('');
  const selectedValid=draft.movements.some(c=>c.selected&&c.date&&/^\\d{4}-\\d{2}-\\d{2}$/.test(c.date)&&c.description?.trim()&&Number(c.amount)>0&&c.type!=='por_revisar');
  return '<section class="nu-review"><h3>Revisa antes de guardar</h3><p class="report-note">'+draft.movements.length+' movimientos detectados. Ninguno se guarda hasta que confirmes.</p><div class="nu-import-meta"><span>Producto: '+esc(productLabel(draft.product))+'</span>'+(draft.period?'<span>Periodo: '+esc(draft.period.start||'')+(draft.period.end?' – '+esc(draft.period.end):'')+'</span>':'')+(draft.openingBalance!==null?'<span>Saldo inicial: '+fmt(draft.openingBalance)+'</span>':'')+(draft.closingBalance!==null?'<span>Saldo final: '+fmt(draft.closingBalance)+'</span>':'')+'</div><div class="nu-import-totals"><span>Incluidos: <b>'+sums.selected+'</b></span><span>Gastos: <b>'+fmt(sums.gasto)+'</b></span><span>Ingresos: <b>'+fmt(sums.ingreso)+'</b></span><span>Devoluciones: <b>'+fmt(sums.devolucion)+'</b></span><span>Movimientos neutrales: <b>'+sums.neutral+'</b></span></div><datalist id="nuImportCategories">'+[...CATEGORIES,...new Set(draft.movements.map(x=>x.category).filter(Boolean))].map(x=>'<option value="'+esc(x)+'">').join('')+'</datalist><div class="nu-review-list">'+(rows||'<div class="empty">El extracto no contiene movimientos detectables.</div>')+'</div><div class="nu-review-actions"><button class="b" type="button" data-nu-action="confirm" '+(selectedValid?'':'disabled')+'>Confirmar e importar seleccionados</button><button class="g" type="button" data-nu-action="cancel">Cancelar y descartar</button></div><p class="report-note">Las transferencias propias, pagos de tarjeta y operaciones anuladas no aumentan los ingresos ni los gastos consolidados. Las coincidencias quedan excluidas inicialmente para que las revises.</p></section>';
}
function productLabel(product){return product==='cuenta_nu'?'Cuenta Nu':product==='tarjeta_nu'?'Tarjeta de crédito Nu':'Producto Nu (por identificar)'}
function renderPanel(){
  const mount=document.getElementById('nuImportMount');if(!mount)return;
  mount.innerHTML='<section class="card nu-import-card"><h2>Importar extracto Nu</h2><p class="report-note">Selecciona un PDF de tu Cuenta Nu o tarjeta de crédito Nu. El archivo se lee en tu navegador y no se conserva.</p><div id="nuPdfDrop" class="nu-drop"><div><b>Arrastra aquí tu extracto</b><span>o selecciona un PDF de hasta 15 MB</span></div><input id="nuPdfInput" type="file" accept=".pdf,application/pdf" aria-label="Seleccionar extracto PDF de Nu" '+(working?'disabled':'')+'>'+(working?'<button class="g" type="button" data-nu-action="cancel">Cancelar lectura</button>':'<button class="g" type="button" data-nu-action="choose">Elegir PDF</button>')+'</div><p id="nuImportStatus" class="report-note '+(statusError?'bad':'')+'" role="status" aria-live="polite">'+esc(statusText)+'</p>'+(draft?'<div class="nu-file-meta">'+esc(draft.fileName)+' · '+bytesText(draft.fileSize)+'</div>'+reviewHtml():'')+'</section>';
}
function loadPdfJs(){
  if(!pdfjsPromise)pdfjsPromise=import(PDFJS_BASE+'build/pdf.mjs').then(lib=>{
    lib.GlobalWorkerOptions.workerSrc=PDFJS_BASE+'build/pdf.worker.mjs';return lib;
  }).catch(error=>{pdfjsPromise=null;throw error});
  return pdfjsPromise;
}
function cancellationError(){const e=new Error('cancelled');e.name='ImportCancelled';return e}
async function readPdf(file){
  if(!file)throw new Error('Selecciona un archivo PDF.');
  if(file.size>MAX_PDF_BYTES)throw new Error('El PDF supera el límite de 15 MB.');
  if(file.size<8)throw new Error('El archivo está vacío o incompleto.');
  const task={cancelled:false,loadingTask:null};currentTask=task;
  const head=new Uint8Array(await file.slice(0,5).arrayBuffer());
  if(task.cancelled)throw cancellationError();
  if(String.fromCharCode(...head)!=='%PDF-')throw new Error('El contenido del archivo no tiene una cabecera PDF válida. Cambia la extensión no lo convierte en PDF.');
  const buffer=await file.arrayBuffer();
  if(task.cancelled)throw cancellationError();
  const pdfjs=await loadPdfJs();
  if(task.cancelled)throw cancellationError();
  const loadingTask=pdfjs.getDocument({data:new Uint8Array(buffer),isEvalSupported:false,cMapUrl:PDFJS_BASE+'cmaps/',cMapPacked:true,standardFontDataUrl:PDFJS_BASE+'standard_fonts/'});
  task.loadingTask=loadingTask;
  loadingTask.onProgress=progress=>{if(!task.cancelled&&progress.total)setStatus('Cargando PDF… '+Math.round(progress.loaded/progress.total*100)+'%')};
  const doc=await loadingTask.promise;
  if(task.cancelled)throw cancellationError();
  if(doc.numPages>MAX_PDF_PAGES){await doc.destroy();throw new Error('El extracto tiene más de 60 páginas. Divide el archivo y prueba con un periodo menor.')}
  const lines=[];let textLength=0;
  try{
    for(let n=1;n<=doc.numPages;n++){
      if(task.cancelled)throw cancellationError();
      setStatus('Leyendo página '+n+' de '+doc.numPages+'…');
      const page=await doc.getPage(n),content=await page.getTextContent({includeMarkedContent:false});
      const pageLines=pdfItemsToLines(content.items||[]);lines.push(...pageLines);textLength+=(content.items||[]).reduce((sum,item)=>sum+String(item.str||'').length,0);page.cleanup();
    }
  }finally{try{await doc.destroy()}catch{}}
  if(task.cancelled)throw cancellationError();
  if(textLength<20)throw new Error('Este PDF parece escaneado o no contiene texto seleccionable. La app no tiene OCR local y no enviará el extracto a ningún servicio. Exporta un PDF con texto o cancela.');
  return {lines,pageCount:doc.numPages,textLength};
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
  draft=null;working=true;statusError=false;setStatus('Validando el archivo…');renderPanel();
  try{
    const parsed=await readPdf(file);
    if(currentTask?.cancelled)throw cancellationError();
    const result=parseNuStatementText(parsed.lines);
    if(!result.compatible)throw new Error(result.warnings.join(' '));
    if(result.product==='producto_nu_no_identificado')result.warnings.push('No se pudo identificar si es cuenta o tarjeta. Revisa cada tipo de movimiento.');
    mapDuplicates(result);
    draft={...result,fileName:file.name,fileSize:file.size,pageCount:parsed.pageCount,movements:result.movements.map(x=>({...x}))};
    statusText=result.movements.length?'Análisis listo. Verifica fechas, montos, clasificación y posibles duplicados.':'Se reconoció un extracto Nu sin movimientos legibles. No se guardó nada.';
    statusError=!result.movements.length;
  }catch(error){
    if(error?.name==='ImportCancelled'){statusText='Importación cancelada. No se guardaron cambios.';statusError=false}
    else{statusText=error?.message?.startsWith('El archivo')||error?.message?.startsWith('El PDF')||error?.message?.startsWith('Este PDF')||error?.message?.startsWith('La app')?error.message:pdfErrorMessage(error);statusError=true}
  }finally{working=false;currentTask=null;renderPanel()}
}
function updateCandidate(input){
  const i=Number(input.dataset.index),field=input.dataset.nuField,c=draft?.movements[i];if(!c)return;
  if(field==='selected')c.selected=input.checked;
  else if(field==='amount')c.amount=input.value===''?null:Number(input.value);
  else c[field]=input.value;
  renderPanel();
}
function canConfirm(rows){return rows.length>0&&rows.every(c=>c.selected&&c.date&&/^\\d{4}-\\d{2}-\\d{2}$/.test(c.date)&&c.description?.trim()&&Number.isFinite(Number(c.amount))&&Number(c.amount)>0&&c.type!=='por_revisar'&&TYPES.some(([v])=>v===c.type))}
function confirmImport(){
  if(!draft||working)return;
  const selected=draft.movements.filter(c=>c.selected);
  if(!canConfirm(selected)){setStatus('Revisa los movimientos marcados e incluye solo fechas, descripciones, montos y tipos válidos.',true);renderPanel();return}
  working=true;renderPanel();const batch=uid(),product=draft.product,rows=selected.map(c=>({id:uid(),type:c.type,name:c.description.trim(),amount:Math.round(Number(c.amount)*100)/100,date:c.date,cat:(c.category||'Otros').trim()||'Otros',method:'Nu',status:c.status||((c.type==='gasto'||c.type==='pago_tarjeta')?'pagado':'recibido'),importedFrom:'nu-pdf',nuProduct:product,importBatchId:batch,bankReference:(c.bankReference||'').trim()||undefined}));
  try{
    const result=window.MCC_IMPORT?.commit?.(rows);
    if(!result?.ok)throw new Error(result?.message||'No se pudieron guardar los movimientos. La copia local anterior permanece intacta.');
    draft=null;statusText='Importación confirmada: '+rows.length+' movimientos incorporados. El PDF no se guardó.';statusError=false;
  }catch(error){statusText=error.message||'No se pudieron guardar los movimientos.';statusError=true}
  finally{working=false;renderPanel()}
}
function cancelImport(){
  if(currentTask){currentTask.cancelled=true;try{currentTask.loadingTask?.destroy()?.catch(()=>{})}catch{}statusText='Cancelando lectura…';statusError=false;renderPanel();return}
  draft=null;working=false;statusText='Importación cancelada. No se guardaron cambios.';statusError=false;
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

