/* ---- Diálogos propios (reemplazan alert, confirm y prompt del navegador) ----
   Todos devuelven una promesa. Si <dialog> no existe en el navegador, se usan los nativos. */
const uiDialogSupported=typeof HTMLDialogElement==='function';
function uiOpen({title,message='',field='',actions}){
  const dlg=document.getElementById('uiDialog');
  if(!uiDialogSupported||!dlg||typeof dlg.showModal!=='function')return null;
  document.getElementById('uiTitle').textContent=title;
  document.getElementById('uiMsg').textContent=message;
  document.getElementById('uiField').innerHTML=field;
  document.getElementById('uiActions').innerHTML=actions.map(a=>`<button class="${a.primary?(a.danger?'b danger':'b'):'g'}" value="${esc(a.value)}" ${a.submit?'':'formnovalidate'}>${esc(a.label)}</button>`).join('');
  return new Promise(resolve=>{
    const done=()=>{dlg.removeEventListener('close',done);const input=dlg.querySelector('#uiInput');resolve({value:dlg.returnValue,input:input?input.value:null})};
    dlg.returnValue='';dlg.addEventListener('close',done);sfx('open');dlg.showModal();
    const focus=dlg.querySelector('#uiInput')||dlg.querySelector('.dialog-actions .b');if(focus)focus.focus();
  });
}
/* Confirmación: true si la persona acepta. */
async function ask(message,{title='¿Confirmas?',confirmLabel='Confirmar',cancelLabel='Cancelar',danger=false}={}){
  const p=uiOpen({title,message,actions:[{label:cancelLabel,value:'no'},{label:confirmLabel,value:'yes',primary:true,danger}]});
  if(!p)return confirm(message);
  return (await p).value==='yes';
}
/* Aviso informativo. */
async function notify(message,{title='Aviso'}={}){
  const p=uiOpen({title,message,actions:[{label:'Entendido',value:'ok',primary:true}]});
  if(!p){alert(message);return}
  await p;
}
/* Elegir entre varias opciones: devuelve el value elegido o null. */
async function choose(message,options,{title='Elige una opción'}={}){
  const p=uiOpen({title,message,actions:[{label:'Cancelar',value:''},...options.map((o,i)=>({label:o.label,value:o.value,primary:i===options.length-1}))]});
  if(!p)return confirm(message)?options[options.length-1].value:options[0].value;
  const r=await p;return r.value||null;
}
/* Pedir un importe en COP: devuelve el número o null si se cancela. */
async function askAmount(message,{title='Importe',value='',confirmLabel='Guardar'}={}){
  const field=`<label class="fl">Valor (COP)<input id="uiInput" type="number" inputmode="numeric" min="0" step="1" value="${esc(value)}" required></label>`;
  const p=uiOpen({title,message,field,actions:[{label:'Cancelar',value:'no'},{label:confirmLabel,value:'yes',primary:true,submit:true}]});
  if(!p){const v=prompt(message,value);return v===null?null:+String(v).replace(/\D/g,'')}
  const r=await p;if(r.value!=='yes')return null;const n=Math.round(Number(r.input));return Number.isFinite(n)&&n>=0?n:null;
}
/* Pedir un número cualquiera (p. ej. minutos): devuelve el número o null si se cancela. */
async function askNumber(message,{title='Dato',label='Valor',value='',confirmLabel='Guardar',min=0}={}){
  const field=`<label class="fl">${esc(label)}<input id="uiInput" type="number" inputmode="numeric" min="${esc(min)}" step="1" value="${esc(value)}" required></label>`;
  const p=uiOpen({title,message,field,actions:[{label:'Cancelar',value:'no'},{label:confirmLabel,value:'yes',primary:true,submit:true}]});
  if(!p){const v=prompt(message,value);return v===null?null:Math.max(min,Math.round(+v)||0)}
  const r=await p;if(r.value!=='yes')return null;const n=Math.round(Number(r.input));return Number.isFinite(n)&&n>=min?n:null;
}
/* Confirmación escrita (acciones irreversibles): devuelve true solo si se escribe la palabra exacta. */
async function askTyped(message,word,{title='Confirmación',confirmLabel='Confirmar'}={}){
  const field=`<label class="fl">Escribe ${esc(word)} para confirmar<input id="uiInput" autocomplete="off" autocapitalize="characters" required></label>`;
  const p=uiOpen({title,message,field,actions:[{label:'Cancelar',value:'no'},{label:confirmLabel,value:'yes',primary:true,danger:true,submit:true}]});
  if(!p)return prompt(message+'\n\nEscribe '+word+' para confirmar.')===word;
  const r=await p;return r.value==='yes'&&String(r.input).trim()===word;
}
