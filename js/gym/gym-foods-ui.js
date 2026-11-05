/* ---- Gym Intelligence · alimentos (fase D1): interfaz ----
   «Escribe lo que comiste» → revisión editable → guardar; recientes con un toque; «Mis alimentos».
   Nada se guarda sin que la persona lo revise. Usa utilidades de gym.js y gym-nutri-ui.js dentro de funciones. */
let gNutMode='text',gNutText='',gNutItems=null,gFoodEdit=null;
const GNF_UNITS=['g','ml','unidad','porción','taza','vaso','cucharada','cucharadita','tajada','plato','lata','botella','paquete','scoop','kg','l'];

function gnfKnownById(id){return gymKnownFoods().find(k=>k.id===id)||null}
/* Recalcula un elemento en revisión según la elección actual. */
function gnfRecalc(it){
  it.notes=(it.baseNotes||[]).slice();
  if(it.choice==='manual'){
    const m=it.manual||{},kc=gymFoodKcal(m);
    it.nutrients={kcal:kc.kcal,protein_g:+m.protein_g||0,carbs_g:+m.carbs_g||0,fat_g:+m.fat_g||0,fiber_g:+m.fiber_g||0};
    it.status=kc.kcal>0||it.nutrients.protein_g>0?(kc.derived||m.estimated?'estimated':'ok'):'nomatch';
    if(kc.derived&&kc.kcal>0)it.notes.push('Calorías calculadas con 4/4/9.');
    if(it.status==='nomatch')it.nutrients=null;
    it.food=null;it.grams=it.unit==='g'?+it.qty:null;return it;
  }
  const k=it.choice?gnfKnownById(it.choice):null;it.food=k;
  if(!k){it.nutrients=null;it.status='nomatch';return it}
  const n=gymScaleFood(k,it.qty,it.unit);
  if(!n){it.nutrients=null;it.status='unit';it.notes.push(`No sé convertir «${it.unit}» para ${k.name}. Usa ${k.serving_unit}${k.grams_per_serving?' o g':''}.`);return it}
  it.nutrients=n;it.grams=it.unit==='g'?+it.qty:k.grams_per_serving?Math.round(n.factor*k.grams_per_serving*10)/10:null;
  it.status=it.forceEstimated||k.estimated?'estimated':'ok';return it;
}
function gnfFromProposal(p){
  const it={raw:p.raw,qty:p.qty,unit:p.unit,food_text:p.food,matches:p.matches.map(m=>({id:m.food.id,name:m.food.name,score:m.score})),choice:p.choice||(p.matches.length?null:'manual'),manual:{},baseNotes:p.notes.filter(n=>!/^No sé convertir/.test(n)),forceEstimated:p.status==='estimated'};
  if(!it.choice)it.choice='manual';
  return gnfRecalc(it);
}
function gnfStatusChip(s){return{ok:'<span class="chip chip-ok">Listo</span>',estimated:'<span class="chip chip-warn">Estimado</span>',unit:'<span class="chip chip-bad">Revisa la unidad</span>',nomatch:'<span class="chip chip-bad">Faltan datos</span>'}[s]||''}

function vNlpReview(){
  const rows=gNutItems.map((it,i)=>{
    const units=[...new Set([it.unit,...GNF_UNITS])].map(u=>`<option ${u===it.unit?'selected':''}>${gesc(u)}</option>`).join('');
    const opts=it.matches.map(m=>`<option value="${gesc(m.id)}" ${m.id===it.choice?'selected':''}>${gesc(m.name)}${m.score<0.75?' (aprox.)':''}</option>`).join('')+`<option value="manual" ${it.choice==='manual'?'selected':''}>Escribir valores a mano</option>`;
    const manual=it.choice==='manual'?`<div class="gnf-manual">${[['kcal','kcal'],['protein_g','Prot. g'],['carbs_g','Carb. g'],['fat_g','Grasa g']].map(([k,n])=>`<label class="fl">${n}<input id="ni-${i}-${k}" data-ni="${i}" data-k="m.${k}" type="number" min="0" step="0.1" inputmode="decimal" value="${gesc(it.manual[k]??'')}"></label>`).join('')}</div>`:'';
    const n=it.nutrients;
    return `<div class="gnf-item is-${it.status}"><div class="gnf-top">${it.raw?`<span class="k">«${gesc(it.raw)}»</span>`:''}${gnfStatusChip(it.status)}<button class="g ic-b" type="button" data-fact="removeItem" data-i="${i}" aria-label="Quitar">${gico('x',14)}</button></div>
      <div class="gnf-grid"><label class="fl">Cantidad<input id="ni-${i}-qty" data-ni="${i}" data-k="qty" type="number" min="0" step="0.1" inputmode="decimal" value="${gesc(it.qty)}"></label>
        <label class="fl">Unidad<select id="ni-${i}-unit" data-ni="${i}" data-k="unit">${units}</select></label>
        <label class="fl gnf-food">Alimento<select id="ni-${i}-choice" data-ni="${i}" data-k="choice">${opts}</select></label></div>
      ${it.choice==='manual'?`<label class="fl">Nombre<input id="ni-${i}-name" data-ni="${i}" data-k="food_text" maxlength="120" value="${gesc(it.food_text||'')}"></label>`:''}
      ${manual}
      <p class="gnf-values">${n?`<b>${gnFmt(n.kcal)} kcal</b> · P ${gnFmt(n.protein_g,1)} · C ${gnFmt(n.carbs_g,1)} · G ${gnFmt(n.fat_g,1)} g`:'Sin valores todavía'}</p>
      ${it.notes.length?`<p class="k">${it.notes.map(gesc).join(' ')}</p>`:''}</div>`}).join('');
  const tot=gNutItems.reduce((a,it)=>a+(it.nutrients?.kcal||0),0),bad=gNutItems.filter(it=>!it.nutrients||it.status==='unit'||it.status==='nomatch').length;
  return `<div class="gnf-review">${rows||'<div class="empty">No queda nada por guardar.</div>'}
    <p class="gnf-total"><b>Total: ${gnFmt(tot)} kcal</b>${bad?` · <span class="gn-over">${bad} ${bad===1?'elemento necesita':'elementos necesitan'} datos</span>`:''}</p>
    <div class="gp-res-actions"><button class="b" type="button" data-fact="saveItems" ${!gNutItems.length||bad?'disabled':''}>${gico('check',15)}<span>Guardar ${gNutItems.length===1?'1 alimento':gNutItems.length+' alimentos'}</span></button>
      <button class="g" type="button" data-fact="backText">Volver a escribir</button><button class="g" type="button" data-nact="cancelFood">Cancelar</button></div></div>`;
}
function vNlpWrite(){
  const known=gymKnownFoods();
  return `<form id="fNlp" class="gnf-write"><label class="fl">Escribe lo que comiste<textarea name="text" rows="3" maxlength="300" placeholder="Ej.: 2 huevos, una arepa con queso y un vaso de jugo de naranja" required>${gesc(gNutText)}</textarea></label>
    <p class="k">${known.length?`Se busca entre tus ${known.length} alimentos (propios y recientes). Lo que no reconozca lo completas antes de guardar.`:'Aún no tienes alimentos guardados ni recientes: lo que escribas lo completarás a mano la primera vez y después se reconocerá.'}</p>
    <div class="gp-res-actions"><button class="b" type="submit">${gico('check',15)}<span>Interpretar</span></button><button class="g" type="button" data-nact="cancelFood">Cancelar</button></div></form>`;
}
function vRecentPicker(){
  const known=gymKnownFoods().slice(0,24);
  if(!known.length)return '<div class="empty">Cuando registres comidas o guardes alimentos propios, aparecerán aquí para añadirlos con un toque.</div>';
  return `<div class="gnf-chips">${known.map(k=>`<button type="button" class="gnf-chip" data-fact="pickKnown" data-id="${gesc(k.id)}"><b>${gesc(k.name)}</b><small>${gnFmt(k.serving_qty,1)} ${gesc(k.serving_unit)} · ${gnFmt(k.kcal)} kcal${k.kind==='custom'?' · propio':k.uses>1?' · '+k.uses+' veces':''}</small></button>`).join('')}</div>
    <p class="k">Se añade a la revisión para que ajustes la cantidad antes de guardar.</p>`;
}
function vAddPanel(meal,date){
  const tabs=[['text','Escribir'],['recent','Recientes y propios'],['manual','Manual']];
  const body=gNutMode==='recent'?vRecentPicker()+(gNutItems?`<p class="k">${gNutItems.length} en revisión. <button class="lk" type="button" data-fact="mode" data-mode="text">Ver revisión</button></p>`:''):gNutMode==='manual'?vFoodForm(meal,date):gNutItems?vNlpReview():vNlpWrite();
  return `<div class="gnf-panel"><div class="gnf-tabs" role="tablist">${tabs.map(([k,n])=>`<button type="button" role="tab" aria-selected="${gNutMode===k}" class="${gNutMode===k?'on':''}" data-fact="mode" data-mode="${k}">${n}</button>`).join('')}</div>${body}</div>`;
}

/* ---- Mis alimentos ---- */
function vCustomForm(f){
  f=f||{serving_qty:100,serving_unit:'g'};
  return `<form id="fCustom" class="gn-form" data-id="${gesc(f.id||'')}">
    <label class="fl wide">Nombre<input name="name" maxlength="120" required value="${gesc(f.name||'')}" placeholder="Ej.: Arepa de maíz blanco"></label>
    <label class="fl wide">Otros nombres (opcional, separados por comas)<input name="aliases" maxlength="200" value="${gesc((f.aliases||[]).join(', '))}" placeholder="arepa blanca, arepita"></label>
    <label class="fl">Porción: cantidad<input name="serving_qty" type="number" min="0.01" step="0.01" required value="${gesc(f.serving_qty)}"></label>
    <label class="fl">Porción: unidad<input name="serving_unit" maxlength="30" required list="gnfUnits" value="${gesc(f.serving_unit)}"></label><datalist id="gnfUnits">${GNF_UNITS.map(u=>`<option value="${u}">`).join('')}</datalist>
    <label class="fl">Gramos por porción<input name="grams_per_serving" type="number" min="0.1" step="0.1" value="${gesc(f.grams_per_serving??'')}" placeholder="Opcional"></label>
    <label class="fl">Calorías (kcal)<input name="kcal" type="number" min="0" max="5000" step="1" value="${gesc(f.kcal??'')}"></label>
    <label class="fl">Proteína (g)<input name="protein_g" type="number" min="0" max="500" step="0.1" value="${gesc(f.protein_g??'')}"></label>
    <label class="fl">Carbohidratos (g)<input name="carbs_g" type="number" min="0" max="1000" step="0.1" value="${gesc(f.carbs_g??'')}"></label>
    <label class="fl">Grasas (g)<input name="fat_g" type="number" min="0" max="500" step="0.1" value="${gesc(f.fat_g??'')}"></label>
    <label class="fl">Fibra (g)<input name="fiber_g" type="number" min="0" max="200" step="0.1" value="${gesc(f.fiber_g??'')}"></label>
    <label class="fl wide">Notas<input name="notes" maxlength="300" value="${gesc(f.notes||'')}" placeholder="Marca, de dónde sacaste los valores…"></label>
    <p class="k wide">Copia los valores de la etiqueta del producto o de una fuente fiable, para la porción que indiques. Si das los gramos por porción, podrás registrarlo también en gramos.</p>
    <div class="gp-res-actions wide"><button class="b" type="submit">${gico('check',15)}<span>${f.id?'Guardar cambios':'Guardar alimento'}</span></button><button class="g" type="button" data-fact="cancelCustom">Cancelar</button></div></form>`;
}
function vCustomFoods(){
  if(GS.customSchema===false)return `<section class="card"><h2>Mis alimentos</h2><p class="sync-banner">${gico('cloud',16)}<span>Tus alimentos propios aún no se pueden guardar: falta aplicar la actualización de la base de datos de Gym.</span></p></section>`;
  const list=GS.customFoods.map(f=>gFoodEdit===f.id?vCustomForm(f):`<div class="row"><div class="g1"><b class="t">${gesc(f.name)}</b><small>${gnFmt(f.serving_qty,1)} ${gesc(f.serving_unit)}${f.grams_per_serving?' ('+gnFmt(f.grams_per_serving,1)+' g)':''} · ${gnFmt(f.kcal)} kcal · P ${gnFmt(f.protein_g,1)} · C ${gnFmt(f.carbs_g,1)} · G ${gnFmt(f.fat_g,1)} g</small></div>
    <button class="g ic-b" type="button" data-fact="editCustom" data-id="${gesc(f.id)}" aria-label="Editar ${gesc(f.name)}">${gico('edit',15)}</button><button class="g ic-b" type="button" data-fact="delCustom" data-id="${gesc(f.id)}" aria-label="Eliminar ${gesc(f.name)}">${gico('x',15)}</button></div>`).join('');
  return `<section class="card"><div class="gn-meal-head"><h2>Mis alimentos</h2>${gFoodEdit==='new'?'':`<button class="lk" type="button" data-fact="newCustom">${gico('plus',14)} Nuevo</button>`}</div>
    ${gFoodEdit==='new'?vCustomForm(null):''}${list||(gFoodEdit==='new'?'':'<div class="empty">Guarda aquí los alimentos que comes a menudo con los valores de su etiqueta. Después los reconocerá al escribir lo que comiste.</div>')}</section>`;
}

/* ---- Eventos ---- */
function gnfRefreshReview(focusId){gRender(false);if(focusId){const el=document.getElementById(focusId);if(el){el.focus();if(el.setSelectionRange&&el.type!=='number')try{el.setSelectionRange(el.value.length,el.value.length)}catch(_){}}}}
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-fact]');if(!b)return;const a=b.dataset.fact;
  if(a==='mode'){gNutMode=b.dataset.mode;gRender(false);return}
  if(a==='pickKnown'){const k=gnfKnownById(b.dataset.id);if(!k)return;const it=gnfRecalc({raw:'',qty:k.serving_qty,unit:k.serving_unit,food_text:k.name,matches:[{id:k.id,name:k.name,score:1}],choice:k.id,manual:{},baseNotes:[]});
    gNutItems=(gNutItems||[]).concat(it);gNutMode='text';sfx('check');gRender(false);return}
  if(a==='removeItem'){gNutItems.splice(+b.dataset.i,1);if(!gNutItems.length)gNutItems=null;gRender(false);return}
  if(a==='backText'){gNutItems=null;gNutMode='text';gRender(false);document.querySelector('#fNlp textarea')?.focus();return}
  if(a==='saveItems'){
    const items=gNutItems.map(it=>({...it,name:it.food?it.food.name:(it.food_text||'').replace(/^./,c=>c.toUpperCase()),estimated:it.status==='estimated'}));
    b.disabled=true;const r=await gTry(()=>gymAddFoods(items,{meal:gNutAdd,date:gnDate(),originalText:gNutText}),items.length===1?'Alimento registrado':items.length+' alimentos registrados');b.disabled=false;
    if(r){sfx('success');gNutItems=null;gNutText='';gNutAdd=null;gNutMode='text';gRender(false)}return}
  if(a==='newCustom'){gFoodEdit='new';gRender(false);document.querySelector('#fCustom input[name=name]')?.focus();return}
  if(a==='editCustom'){gFoodEdit=b.dataset.id;gRender(false);return}
  if(a==='cancelCustom'){gFoodEdit=null;gRender(false);return}
  if(a==='delCustom'){const f=GS.customFoods.find(x=>x.id===b.dataset.id);if(!f)return;
    if(!await ask(`Se borrará «${f.name}» de tus alimentos. Lo que ya registraste con él se conserva.`,{title:'¿Eliminar alimento?',confirmLabel:'Eliminar',danger:true}))return;
    const ok=await gTry(()=>gymDeleteCustomFood(f.id).then(()=>true),'Alimento eliminado');if(ok)sfx('delete');gRender(false);return}
});
document.addEventListener('input',e=>{const t=e.target;if(t.id==='fNlpText'||t.name==='text'&&t.form?.id==='fNlp')gNutText=t.value});
document.addEventListener('change',e=>{
  const t=e.target;if(t.dataset.ni===undefined||!gNutItems)return;
  const it=gNutItems[+t.dataset.ni];if(!it)return;const k=t.dataset.k;
  if(k.startsWith('m.'))it.manual[k.slice(2)]=t.value;
  else if(k==='qty')it.qty=+t.value;
  else it[k]=t.value;
  if(k==='choice'&&t.value==='manual'&&!it.food_text)it.food_text=it.raw;
  gnfRecalc(it);setTimeout(()=>{const a=document.activeElement,next=a&&a!==document.body&&a.id?a.id:t.id;gnfRefreshReview(next)},0);
});
document.addEventListener('submit',async e=>{
  const f=e.target;
  if(f.id==='fNlp'){e.preventDefault();gNutText=new FormData(f).get('text')||'';
    const props=gymParseMeal(gNutText).map(i=>gymProposeItem(i,gymKnownFoods()));
    if(!props.length){await notify('No encontré alimentos en el texto. Prueba con algo como «2 huevos y una arepa».',{title:'Nada que interpretar'});return}
    gNutItems=props.map(gnfFromProposal);sfx('tap');gRender(false);return}
  if(f.id==='fCustom'){e.preventDefault();const v=Object.fromEntries(new FormData(f)),btn=f.querySelector('[type=submit]');btn.disabled=true;
    const r=await gTry(()=>gymSaveCustomFood(v,f.dataset.id||null),'Alimento guardado');btn.disabled=false;if(r){sfx('success');gFoodEdit=null;gRender(false)}}
});
