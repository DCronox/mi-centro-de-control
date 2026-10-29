import { MAX_PDF_BYTES, MAX_PDF_PAGES, pdfItemsToLines } from './nu-pdf-import.mjs';

function cancelledError(){const error=new Error('Lectura del PDF cancelada.');error.name='ImportCancelled';return error}

/** Reads a text-based PDF in the browser. `loadPdfJs` is injected to keep the
 * reader testable without a CDN or a real statement. */
export async function readPdfDocument(file,loadPdfJs,{isCancelled=()=>false,onStatus=()=>{},onLoadingTask=()=>{},getDocumentOptions={}}={}){
  if(!file)throw new Error('Selecciona un archivo PDF.');
  if(file.size>MAX_PDF_BYTES)throw new Error('El PDF supera el límite de 15 MB.');
  if(file.size<8)throw new Error('El archivo está vacío o incompleto.');
  onStatus('Validando que el archivo tenga formato PDF…');
  const head=new Uint8Array(await file.slice(0,5).arrayBuffer());
  if(isCancelled())throw cancelledError();
  if(String.fromCharCode(...head)!=='%PDF-')throw new Error('El contenido del archivo no tiene una cabecera PDF válida. Cambiar la extensión no lo convierte en PDF.');
  onStatus('Archivo PDF válido. Preparando lectura segura en este dispositivo…');
  const buffer=await file.arrayBuffer();
  if(isCancelled())throw cancelledError();
  const pdfjs=await loadPdfJs();
  if(isCancelled())throw cancelledError();
  const loadingTask=pdfjs.getDocument({...getDocumentOptions,data:new Uint8Array(buffer),isEvalSupported:false});
  onLoadingTask(loadingTask);
  let doc;
  try{doc=await loadingTask.promise}catch(error){if(isCancelled())throw cancelledError();throw error}
  if(isCancelled())throw cancelledError();
  const pageCount=doc.numPages;
  if(pageCount>MAX_PDF_PAGES){try{await doc.destroy()}catch{}throw new Error('El extracto tiene más de 60 páginas. Divide el archivo y prueba con un periodo menor.');}
  const lines=[];let textLength=0;
  try{
    for(let pageNumber=1;pageNumber<=pageCount;pageNumber++){
      if(isCancelled())throw cancelledError();
      onStatus('Extrayendo texto de la página '+pageNumber+' de '+pageCount+'…');
      const page=await doc.getPage(pageNumber),content=await page.getTextContent({includeMarkedContent:false});
      const items=content.items||[];lines.push(...pdfItemsToLines(items));textLength+=items.reduce((sum,item)=>sum+String(item.str||'').length,0);page.cleanup?.();
    }
  }catch(error){if(isCancelled())throw cancelledError();throw error}
  finally{try{await doc.destroy()}catch{}}
  if(isCancelled())throw cancelledError();
  if(textLength<20)throw new Error('El PDF se abrió, pero no contiene texto seleccionable. Probablemente es un escaneo; esta app no ejecuta OCR. Exporta desde Nu el extracto original en PDF digital y vuelve a probar.');
  return{lines,pageCount,textLength};
}
