/* ---- Gym Intelligence · panel nutricional (fase C) ----
   Círculos de calorías y macronutrientes, agua, comidas del día y comparación semanal.
   Usa utilidades de gym.js (gesc, gico, gToast, gRender, gTry…) solo dentro de funciones. */
let gNutDate=null,gNutAdd=null;
const gnDate=()=>gNutDate||gymToday();
const gnFmt=(n,d=0)=>(+n||0).toLocaleString('es-CO',{maximumFractionDigits:d});

/* Anillo SVG. El arco llega como máximo a la vuelta completa; el exceso cambia el color y se indica en texto. */
function gnRing(p,{size=120,stroke=11,cls=''}={}){
  const r=(size-stroke)/2,c=2*Math.PI*r,off=c*(1-(p.ring||0));
  const st=p.state==='over'?'is-over':p.state==='ok'?'is-ok':'';
  return `<svg class="gn-ring ${cls} ${st}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle class="gn-track" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}" fill="none"/>
    <circle class="gn-arc" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}" fill="none" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${size/2} ${size/2})"/></svg>`;
}
function gnStatus(p,unit){
  if(p.state==='none')return 'Sin objetivo';
  if(p.over>0)return `+${gnFmt(p.value-p.target,unit==='kcal'?0:1)} ${unit} sobre el objetivo (${p.pct} %)`;
  if(p.remaining>0)return `Faltan ${gnFmt(p.remaining,unit==='kcal'?0:1)} ${unit} · ${p.pct} %`;
  return `Objetivo alcanzado · ${p.pct} %`;
}

function vNutriRings(tot,tg){
  const kc=gymProgress(tot.kcal,tg?.kcal);
  const macro=(k,n)=>{const p=gymProgress(tot[k],tg?.[k]);return `<div class="gn-mini" role="img" aria-label="${n}: ${gnFmt(tot[k],1)} de ${p.target?gnFmt(p.target)+' g':'sin objetivo'}">
    <div class="gn-ring-wrap">${gnRing(p,{size:76,stroke:8})}<b>${p.pct===null?'—':p.pct+'%'}</b></div>
    <span class="gn-mini-name">${n}</span><span class="gn-mini-val">${gnFmt(tot[k],1)}${p.target?' / '+gnFmt(p.target):''} g</span>${p.over?`<span class="gn-over">+${p.over} %</span>`:''}</div>`};
  return `<section class="card gn-main">
    <div class="gn-big" role="img" aria-label="Calorías: ${gnFmt(tot.kcal)} de ${kc.target?gnFmt(kc.target):'sin objetivo'}">
      <div class="gn-ring-wrap">${gnRing(kc,{size:168,stroke:14,cls:'gn-ring-big'})}<div class="gn-big-txt"><b>${gnFmt(tot.kcal)}</b><span>${kc.target?'de '+gnFmt(kc.target)+' kcal':'kcal'}</span></div></div>
      <p class="gn-status ${kc.state==='over'?'is-over':''}">${gesc(gnStatus(kc,'kcal'))}</p></div>
    <div class="gn-macros">${macro('protein_g','Proteína')}${macro('carbs_g','Carbohidratos')}${macro('fat_g','Grasas')}${macro('fiber_g','Fibra')}</div>
    ${tot.estimated?`<p class="k gn-note">${gico('info',13)} ${tot.estimated} ${tot.estimated===1?'registro tiene':'registros tienen'} valores estimados.</p>`:''}
  </section>`;
}
function vNutriWater(tot,tg,date){
  const p=gymProgress(tot.water_ml,tg?.water_ml),pct=Math.round((p.ring||0)*100);
  return `<section class="card gn-water"><div class="gn-water-head"><h2>Agua</h2><span><b>${gnFmt(tot.water_ml/1000,2)} L</b>${p.target?' de '+gnFmt(p.target/1000,1)+' L':''}</span></div>
    <div class="gn-bar ${p.state==='over'?'is-over':''}" role="progressbar" aria-label="Agua" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
    <div class="gn-water-btns"><button class="g" type="button" data-nact="water" data-ml="250">+250 ml</button><button class="g" type="button" data-nact="water" data-ml="500">+500 ml</button><button class="g" type="button" data-nact="water" data-ml="750">+750 ml</button>
      ${tot.water_ml?`<button class="lk" type="button" data-nact="undoWater">Deshacer último</button>`:''}</div>
    <p class="k">El objetivo es agua total (bebidas y alimentos); aquí registras lo que bebes.</p></section>`;
}
function vFoodForm(meal,date){
  return `<form id="fFood" class="gn-form" data-meal="${meal}">
    <label class="fl wide">¿Qué comiste?<input name="name" maxlength="120" required autocomplete="off" placeholder="Ej.: arepa con queso"></label>
    <label class="fl">Cantidad<input name="quantity" type="number" min="0" step="0.1" inputmode="decimal" placeholder="Opcional"></label>
    <label class="fl">Unidad<input name="unit" maxlength="30" placeholder="g, unidad, taza…"></label>
    <label class="fl">Calorías (kcal)<input name="kcal" type="number" min="0" max="5000" step="1" inputmode="decimal"></label>
    <label class="fl">Proteína (g)<input name="protein_g" type="number" min="0" max="500" step="0.1" inputmode="decimal"></label>
    <label class="fl">Carbohidratos (g)<input name="carbs_g" type="number" min="0" max="1000" step="0.1" inputmode="decimal"></label>
    <label class="fl">Grasas (g)<input name="fat_g" type="number" min="0" max="500" step="0.1" inputmode="decimal"></label>
    <label class="fl">Fibra (g)<input name="fiber_g" type="number" min="0" max="200" step="0.1" inputmode="decimal"></label>
    ${GS.customSchema?'<label class="gp-check wide"><input type="checkbox" name="saveCustom"><span><b>Guardar también en Mis alimentos</b><small>Con esta cantidad como porción, para reconocerlo la próxima vez</small></span></label>':''}<label class="gp-check wide"><input type="checkbox" name="estimated"><span><b>Son valores aproximados</b><small>Márcalo si calculaste a ojo</small></span></label>
    <p class="k wide">Si no sabes las calorías, escribe los macronutrientes y se calculan (4 kcal por g de proteína y carbohidratos, 9 por g de grasa); quedará marcado como estimado. </p>
    <div class="gp-res-actions wide"><button class="b" type="submit">${gico('check',15)}<span>Guardar</span></button><button class="g" type="button" data-nact="cancelFood">Cancelar</button></div></form>`;
}
function vNutriMeals(date){
  const day=GS.foods.filter(f=>f.date===date);
  return `<section class="card gn-meals"><h2>Comidas</h2>${Object.entries(GYM_MEALS).map(([k,n])=>{
    const list=day.filter(f=>f.meal===k),kc=list.reduce((a,f)=>a+(+f.kcal||0),0);
    return `<div class="gn-meal"><div class="gn-meal-head"><b>${n}</b><span class="k">${list.length?gnFmt(kc)+' kcal':''}</span>${gNutAdd===k?'':`<button class="lk" type="button" data-nact="addFood" data-meal="${k}">${gico('plus',14)} Añadir</button>`}</div>
      ${list.map(f=>`<div class="row"><div class="g1"><b class="t">${gesc(f.name)}${f.quantity?` <span class="k">· ${gnFmt(f.quantity,1)} ${gesc(f.unit||'')}</span>`:''}</b><small>${gnFmt(f.kcal)} kcal · P ${gnFmt(f.protein_g,1)} · C ${gnFmt(f.carbs_g,1)} · G ${gnFmt(f.fat_g,1)} g${f.estimated?' · <span class="tag">estimado</span>':''}</small></div><button class="g ic-b" type="button" data-nact="delFood" data-id="${gesc(f.id)}" aria-label="Eliminar ${gesc(f.name)}">${gico('x',15)}</button></div>`).join('')}
      ${gNutAdd===k?vAddPanel(k,date):''}</div>`}).join('')}</section>`;
}
function vNutriWeek(date){
  const w=gymWeekNutrition(GS.foods,GS.water,GS.targets,date),dn=['D','L','M','X','J','V','S'];
  const max=Math.max(1.3,...w.days.map(d=>d.kcal.target?d.totals.kcal/d.kcal.target:0));
  const bars=w.days.map(d=>{const t=d.kcal.target,ratio=t?d.totals.kcal/t:0,h=t?Math.min(100,ratio/max*100):0,day=new Date(d.date+'T12:00:00Z').getUTCDay();
    return `<div class="gn-col ${d.date===date?'is-sel':''}" title="${gesc(fshort(d.date))}: ${d.logged?gnFmt(d.totals.kcal)+' kcal':'sin registro'}"><div class="gn-col-bar">${d.logged?`<i class="${ratio>1.1?'is-over':ratio>=0.9?'is-ok':''}" style="height:${Math.max(3,h)}%"></i>`:''}${t?`<em style="bottom:${(1/max*100).toFixed(1)}%"></em>`:''}</div><span>${dn[day]}</span></div>`}).join('');
  const summary=!w.loggedDays?'<div class="empty">Aún no hay comidas registradas en estos 7 días.</div>':
    `<div class="stats"><div><span class="k">Promedio diario</span><b>${gnFmt(w.avg.kcal)} kcal</b><small>${w.loggedDays} de 7 días con registro</small></div>
     <div><span class="k">Frente a la semana anterior</span><b>${w.kcalChangePct===null?'—':(w.kcalChangePct>0?'+':'')+w.kcalChangePct+' %'}</b><small>${w.prevAvg?gnFmt(w.prevAvg.kcal)+' kcal de promedio ('+w.prevAvg.days+' días)':'Sin registros para comparar'}</small></div>
     <div><span class="k">Días con proteína ≥ 90 %</span><b>${w.withTarget?w.proteinHit+' de '+w.withTarget:'—'}</b><small>Promedio ${gnFmt(w.avg.protein_g,1)} g</small></div>
     <div><span class="k">Días dentro de ±10 % de kcal</span><b>${w.withTarget?w.kcalInRange+' de '+w.withTarget:'—'}</b><small>Solo días con registro y objetivo</small></div></div>`;
  return `<section class="card"><h2>Últimos 7 días</h2><div class="gn-week" role="img" aria-label="Calorías de los últimos 7 días frente al objetivo">${bars}</div>
    <p class="k gn-legend"><i class="gn-leg-line"></i> objetivo · los promedios solo cuentan días con registro.</p>${summary}</section>`;
}

function vNutricion(){
  const gate=needAccount('tu alimentación');if(gate)return gate;
  const date=gnDate(),today=gymToday(),tot=gymDayTotals(GS.foods,GS.water,date),tg=gymTargetFor(GS.targets,date);
  const nav=`<div class="gn-daynav"><button class="g ic-b" type="button" data-nact="prevDay" aria-label="Día anterior">${gico('back',16)}</button>
    <div><b>${date===today?'Hoy':date===gymAddDays(today,-1)?'Ayer':gesc(fdate(date))}</b>${date!==today?`<button class="lk" type="button" data-nact="today">Ir a hoy</button>`:`<span class="k">${gesc(fdate(date))}</span>`}</div>
    <button class="g ic-b" type="button" data-nact="nextDay" aria-label="Día siguiente" ${date>=today?'disabled':''}>${gico('right',16)}</button></div>`;
  const banner=GS.nutriSchema===false?`<p class="sync-banner">${gico('cloud',16)}<span>El registro de comidas y agua aún no se puede guardar: falta aplicar la actualización de la base de datos de Gym.</span></p>`:'';
  const noTarget=tg?'':(gProfileCta()||`<section class="card"><p class="k">No hay un objetivo vigente para este día. <button class="lk" type="button" data-g="perfil">Definir objetivos</button></p></section>`);
  return banner+nav+noTarget+vNutriRings(tot,tg)+`<div class="cols">${vNutriWater(tot,tg,date)}${vNutriWeek(date)}</div>`+vNutriMeals(date)+vCustomFoods();
}

/* ---- Eventos ---- */
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-nact]');if(!b)return;const a=b.dataset.nact,date=gnDate();
  if(a==='prevDay'||a==='nextDay'||a==='today'){
    const next=a==='today'?gymToday():gymAddDays(date,a==='prevDay'?-1:1);if(next>gymToday())return;
    gNutDate=next===gymToday()?null:next;gNutAdd=null;await gymEnsureNutritionFor(next);gRender(false);return}
  if(a==='water'){b.disabled=true;const r=await gTry(()=>gymAddWater(date,+b.dataset.ml));if(r){sfx('check');gRender(false)}else b.disabled=false;return}
  if(a==='undoWater'){const r=await gTry(()=>gymUndoWater(date));if(r){gToast(`Se quitaron ${r.ml} ml`);gRender(false)}return}
  if(a==='addFood'){gNutAdd=b.dataset.meal;gNutItems=null;gNutText='';gNutMode='text';gRender(false);document.querySelector('#fNlp textarea')?.focus();return}
  if(a==='cancelFood'){gNutAdd=null;gNutItems=null;gNutText='';gRender(false);return}
  if(a==='delFood'){const f=GS.foods.find(x=>x.id===b.dataset.id);if(!f)return;
    if(!await ask(`Se borrará «${f.name}» (${gnFmt(f.kcal)} kcal) de este día.`,{title:'¿Eliminar registro?',confirmLabel:'Eliminar',danger:true}))return;
    const ok=await gTry(()=>gymDeleteFood(f.id).then(()=>true),'Registro eliminado');if(ok)sfx('delete');gRender(false);return}
});
document.addEventListener('submit',async e=>{
  const f=e.target;if(f.id!=='fFood')return;e.preventDefault();
  const v=Object.fromEntries(new FormData(f));v.meal=f.dataset.meal;v.date=gnDate();v.estimated=new FormData(f).has('estimated');
  const errs=gymValidateFood(v);if(errs.length){await notify(errs.join(' '),{title:'Revisa el registro'});return}
  const btn=f.querySelector('[type=submit]');btn.disabled=true;
  const r=await gTry(()=>gymAddFood(v),'Comida registrada');btn.disabled=false;
  if(r&&new FormData(f).has('saveCustom')&&!GS.customFoods.some(c=>gfNorm(c.name)===gfNorm(r.name))){const u=r.unit||'porción';await gTry(()=>gymSaveCustomFood({name:r.name,serving_qty:r.quantity||1,serving_unit:u,grams_per_serving:gfUnitKey(u)==='g'?r.quantity:'',kcal:r.kcal,protein_g:r.protein_g,carbs_g:r.carbs_g,fat_g:r.fat_g,fiber_g:r.fiber_g}))}
  if(r){sfx('success');gNutAdd=null;gRender(false)}
});
