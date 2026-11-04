/* ---- Gym Intelligence · evaluación inicial y «Tus objetivos» (fase B) ----
   Se carga antes de gym.js; usa sus utilidades (gesc, gico, gToast, gRender…) solo dentro de funciones.
   Calcula en el dispositivo (gym-engine.js) y guarda en gym_profiles / nutrition_targets (gym-store.js). */
const GP_STEPS=['Datos básicos','Objetivo','Actividad diaria','Entrenamiento','Salud y seguridad'];
const gpNum=(n,d=0)=>(+n).toLocaleString('es-CO',{maximumFractionDigits:d});
const gpRange=r=>{if(!r)return '';const d=Math.abs(r[1])<10?2:0;return `${gpNum(r[0],d)}–${gpNum(r[1],d)}`};

function gpRadios(name,opts,val,{cols}={}){return `<div class="gp-opts ${cols?'gp-opts-'+cols:''}" role="radiogroup">${Object.entries(opts).map(([k,o])=>`<label class="gp-opt"><input type="radio" name="${name}" value="${k}" ${val===k?'checked':''} required><span><b>${gesc(o.label)}</b>${o.hint?`<small>${gesc(o.hint)}</small>`:''}</span></label>`).join('')}</div>`}
function gpCheck(name,label,val,hint){return `<label class="gp-check"><input type="checkbox" name="${name}" ${val?'checked':''}><span><b>${gesc(label)}</b>${hint?`<small>${gesc(hint)}</small>`:''}</span></label>`}

/* Valores iniciales: borrador > perfil guardado > último peso registrado. */
function gpValues(){
  if(gProfDraft)return gProfDraft;
  if(GS.profile)return{...GS.profile};
  const w=[...(GS.metrics||[])].filter(m=>m.weight_kg!==null).sort((a,b)=>b.date.localeCompare(a.date))[0];
  return{weight_kg:w?+w.weight_kg:'',cardio_min_week:0,equipment:'gym',secondary_goals:[]};
}
function gpReadForm(f){const fd=new FormData(f),v=Object.fromEntries(fd);v.secondary_goals=fd.getAll('secondary_goals');['pregnant','lactating','condition','medication','eating_disorder'].forEach(k=>v[k]=fd.has(k));return gymProfileRow(v)}

function vProfileWizard(){
  const v=gpValues(),y=new Date().getFullYear(),st=gProfStep;
  const fs=(i,body)=>`<fieldset class="gp-step" data-step="${i}" ${i===st?'':'hidden'}><legend>${i+1}. ${GP_STEPS[i]}</legend>${body}</fieldset>`;
  const prog=`<ol class="gp-progress" aria-label="Paso ${st+1} de ${GP_STEPS.length}">${GP_STEPS.map((n,i)=>`<li class="${i<st?'is-done':''} ${i===st?'is-on':''}"><span>${i+1}</span><em>${gesc(n)}</em></li>`).join('')}</ol>`;
  const secondary=Object.entries(GYM_GOALS).map(([k,o])=>`<label><input type="checkbox" name="secondary_goals" value="${k}" ${(v.secondary_goals||[]).includes(k)?'checked':''}><span>${gesc(o.label)}</span></label>`).join('');
  return `<section class="card gp-card">${prog}<form id="fProfile" novalidate>
    ${fs(0,`<div class="gp-grid">
      <label class="fl">Año de nacimiento<input type="number" name="birth_year" min="${y-100}" max="${y-10}" step="1" inputmode="numeric" value="${gesc(v.birth_year??'')}" required></label>
      <label class="fl">Estatura (cm)<input type="number" name="height_cm" min="120" max="230" step="0.5" inputmode="decimal" value="${gesc(v.height_cm??'')}" required></label>
      <label class="fl">Peso actual (kg)<input type="number" name="weight_kg" min="30" max="300" step="0.1" inputmode="decimal" value="${gesc(v.weight_kg??'')}" required></label></div>
      <p class="fl-title">Sexo para las ecuaciones</p>${gpRadios('sex',{f:{label:'Mujer'},m:{label:'Hombre'},x:{label:'Prefiero no decirlo',hint:'Se usa un valor intermedio con un rango más amplio'}},v.sex,{cols:3})}
      <p class="k">Las ecuaciones de gasto energético usan sexo biológico, edad, estatura y peso. Solo se usan para calcular.</p>`)}
    ${fs(1,`<p class="fl-title">Objetivo principal</p>${gpRadios('goal',GYM_GOALS,v.goal,{cols:2})}
      <fieldset class="days gp-sec"><legend>Otros objetivos (opcional)</legend>${secondary}</fieldset>`)}
    ${fs(2,`<p class="fl-title">¿Cómo es tu día normal?</p>${gpRadios('occupation',GYM_OCCUPATIONS,v.occupation,{cols:2})}
      <p class="fl-title">¿Cuánto caminas al día, sumando todo?</p>${gpRadios('walking',GYM_WALKING,v.walking,{cols:3})}
      <div class="gp-grid"><label class="fl">Cardio por semana (minutos)<input type="number" name="cardio_min_week" min="0" max="1500" step="5" inputmode="numeric" value="${gesc(v.cardio_min_week??0)}"><small class="k">Correr, bici, natación, clases… 0 si no haces.</small></label></div>`)}
    ${fs(3,`<p class="fl-title">Experiencia con pesas</p>${gpRadios('experience',GYM_EXPERIENCE,v.experience,{cols:2})}
      <div class="gp-grid"><label class="fl">Días de entrenamiento por semana<input type="number" name="training_days" min="0" max="7" step="1" inputmode="numeric" value="${gesc(v.training_days??'')}" required></label>
      <label class="fl">Duración por sesión (min)<input type="number" name="session_min" min="0" max="240" step="5" inputmode="numeric" value="${gesc(v.session_min??'')}" required></label>
      <label class="fl">Dónde entrenas<select name="equipment">${[['gym','Gimnasio'],['home','Casa con equipo'],['bodyweight','Peso corporal'],['mixed','Mixto']].map(([k,n])=>`<option value="${k}" ${v.equipment===k?'selected':''}>${n}</option>`).join('')}</select></label>
      <label class="fl">Horas de sueño habituales<input type="number" name="sleep_hours" min="0" max="16" step="0.5" inputmode="decimal" value="${gesc(v.sleep_hours??'')}" placeholder="Opcional"></label></div>`)}
    ${fs(4,`<p class="k">Opcional y privado: solo tú puedes verlo. Si marcas algo, la app no propone déficit ni superávit y te recomienda un profesional.</p>
      <div class="gp-checks">${gpCheck('pregnant','Embarazo',v.pregnant)}${gpCheck('lactating','Lactancia',v.lactating)}
      ${gpCheck('condition','Condición de salud relevante',v.condition,'Por ejemplo diabetes, enfermedad renal, cardiaca o tiroidea')}
      ${gpCheck('medication','Medicación que afecta el peso o el apetito',v.medication)}
      ${gpCheck('eating_disorder','Antecedente de trastorno de la conducta alimentaria',v.eating_disorder)}</div>
      <label class="fl">Notas (opcional)<input name="notes" maxlength="500" value="${gesc(v.notes||'')}" placeholder="Lesiones, preferencias…"></label>`)}
    <div class="gp-nav">${st>0?`<button type="button" class="g" data-pact="prev">${gico('back',15)}<span>Atrás</span></button>`:(GS.profile?`<button type="button" class="g" data-pact="cancelEdit">Cancelar</button>`:'<span></span>')}
      ${st<GP_STEPS.length-1?`<button type="button" class="b" data-pact="next"><span>Siguiente</span>${gico('right',15)}</button>`:`<button type="submit" class="b">${gico('check',15)}<span>Calcular mis objetivos</span></button>`}</div>
  </form></section>
  <p class="k gp-disclaimer">${gico('info',14)} Estimaciones orientativas basadas en ecuaciones y guías publicadas. No sustituyen la valoración de un profesional de la salud.</p>`;
}

function gpWarnings(r){return r.warnings.length?`<ul class="gp-warn">${r.warnings.map(w=>`<li>${gico('info',15)}<span>${gesc(w)}</span></li>`).join('')}</ul>`:''}
function gpRefs(keys){return `<ol class="gp-refs">${keys.filter(k=>GYM_REFS[k]).map(k=>{const r=GYM_REFS[k];return `<li><b>${gesc(r.topic)}.</b> ${gesc(r.org)} ${gesc(r.title)}. <i>${gesc(r.pub)}</i>. <a href="${gesc(r.url)}" target="_blank" rel="noopener noreferrer">Ver fuente</a></li>`}).join('')}</ol>`}
function gpSteps(r){return `<details class="gp-how"><summary>Cómo se calculó</summary><ol class="gp-steps">${r.steps.map(s=>`<li><div><b>${gesc(s.label)}</b><span>${gesc(s.detail||'')}</span></div><em>${s.value!==undefined?gpNum(s.value,2)+(s.unit?' '+s.unit:''):''}${s.range?`<small>rango ${gpRange(s.range)}</small>`:''}</em></li>`).join('')}</ol><h3>Referencias</h3>${gpRefs(r.refs)}</details>`}
function gpTiles(t){
  const tile=(n,v,u,sub)=>`<div class="gp-tile"><span class="k">${n}</span><b>${v}<small> ${u}</small></b>${sub?`<small>${sub}</small>`:''}</div>`;
  return `<div class="gp-tiles">${tile('Proteína',gpNum(t.protein),'g',t.proteinSub)}${tile('Carbohidratos',gpNum(t.carbs),'g')}${tile('Grasas',gpNum(t.fat),'g')}${tile('Fibra',gpNum(t.fiber),'g')}${tile('Agua',gpNum(t.water,1),'L','total al día')}</div>`;
}

function vProfileResult(){
  const r=gProfResult,saveOk=GS.profileSchema===true;
  if(!r.ok)return `<section class="card"><h2>Revisa tus respuestas</h2><ul class="gp-warn">${r.errors.map(e=>`<li>${gico('info',15)}<span>${gesc(e)}</span></li>`).join('')}</ul><button class="b" type="button" data-pact="edit">Editar respuestas</button></section>`;
  const head=`<div class="gp-res-actions">${r.explainOnly?'<button class="g" type="button" data-pact="cancelEdit">Volver</button>':''}<button class="g" type="button" data-pact="edit">${gico('edit',15)}<span>Editar respuestas</span></button></div>`;
  if(!r.energy)return `<section class="card gp-safe"><h2>${gico('info',20)} Te recomendamos acompañamiento profesional</h2>${gpWarnings(r)}
    ${r.water&&r.water.liters?`<p class="k">Referencia general de agua: ${gpNum(r.water.liters,1)} L al día (total). ${gesc(r.water.note)}</p>`:''}
    <p class="k">Puedes seguir usando Gym para registrar entrenos, medidas y descanso. No se guarda ningún objetivo de calorías.</p>${head}</section>`;
  const e=r.energy,m=r.macros,unsaved=!saveOk?`<p class="sync-banner">${gico('cloud',16)}<span>Cálculo hecho en tu dispositivo. Para guardarlo falta aplicar la actualización de la base de datos de Gym.</span></p>`:'';
  const goalTxt=e.goal!==gProfDraftGoal()?`${gesc(GYM_GOALS[e.goal].label)} (modo prudente)`:gesc(GYM_GOALS[e.goal].label);
  if(gProfManual)return unsaved+vManualForm(r);
  return `${unsaved}<section class="card gp-hero"><span class="hero-label">Objetivo diario propuesto · ${goalTxt}</span>
    <div class="gp-kcal"><b>${gpNum(e.kcal)}</b><span>kcal al día</span></div>
    <p class="k">Rango probable: <b>${gpRange(e.kcalRange)} kcal</b>. Tu mantenimiento estimado es ${gpNum(e.tdee)} kcal (${gpRange(e.tdeeRange)}).${e.weeklyKg?` Ritmo orientativo: ${e.adjust<0?'−':'+'}${gpNum(e.weeklyKg,2)} kg por semana.`:''}</p>
    ${gpTiles({protein:m.protein,carbs:m.carbs,fat:m.fat,fiber:m.fiber,water:r.water.liters,proteinSub:gpNum(m.proteinPerKg,1)+' g/kg'})}
    <p class="k">Es una estimación: el gasto real varía de una persona a otra. Con tu peso registrado durante 2–3 semanas se podrá ajustar.</p>
    ${gpWarnings(r)}
    <div class="gp-res-actions">${saveOk?`<button class="b" type="button" data-pact="accept">${gico('check',15)}<span>Aceptar estos objetivos</span></button>`:''}
      <button class="g" type="button" data-pact="manual">${gico('edit',15)}<span>Ajustar manualmente</span></button>
      <button class="g" type="button" data-pact="edit"><span>Editar respuestas</span></button>${r.explainOnly?'<button class="g" type="button" data-pact="cancelEdit">Volver</button>':''}</div></section>
  <section class="card">${gpSteps(r)}</section>`;
}
function gProfDraftGoal(){return(gProfDraft||GS.profile||{}).goal}

function vManualForm(r){
  const e=r.energy,m=r.macros;
  return `<section class="card"><h2>Ajustar objetivos manualmente</h2>
    <p class="k">Propuesta calculada: ${gpNum(e.kcal)} kcal · ${m.protein} g proteína · ${m.carbs} g carbohidratos · ${m.fat} g grasas. Si un profesional te dio otros valores, escríbelos aquí.</p>
    <form id="fManual" class="gp-grid">
      <label class="fl">Calorías (kcal)<input type="number" name="kcal" min="800" max="8000" step="10" value="${e.kcal}" required></label>
      <label class="fl">Proteína (g)<input type="number" name="protein_g" min="0" max="600" step="1" value="${m.protein}" required></label>
      <label class="fl">Carbohidratos (g)<input type="number" name="carbs_g" min="0" max="1500" step="1" value="${m.carbs}" required></label>
      <label class="fl">Grasas (g)<input type="number" name="fat_g" min="0" max="400" step="1" value="${m.fat}" required></label>
      <label class="fl">Fibra (g)<input type="number" name="fiber_g" min="0" max="150" step="1" value="${m.fiber}"></label>
      <label class="fl">Agua (L)<input type="number" name="water_l" min="0" max="10" step="0.1" value="${r.water.liters}"></label>
      <p class="k wide" id="manualCheck" aria-live="polite">${gpManualCheck(r,{kcal:e.kcal,protein_g:m.protein,carbs_g:m.carbs,fat_g:m.fat})}</p>
      <div class="gp-res-actions wide"><button class="b" type="submit">${gico('check',15)}<span>Guardar mis valores</span></button><button class="g" type="button" data-pact="manualCancel">Cancelar</button></div>
    </form></section>`;
}
function gpManualCheck(r,v){
  const kcal=+v.kcal||0,mk=(+v.protein_g||0)*4+(+v.carbs_g||0)*4+(+v.fat_g||0)*9,out=[];
  out.push(`Las calorías de tus macronutrientes suman ${gpNum(mk)} kcal${kcal?` (${mk>=kcal?'+':''}${gpNum(Math.round((mk-kcal)/kcal*100))} % frente a ${gpNum(kcal)})`:''}.`);
  if(r.energy&&kcal&&kcal<r.energy.bmr)out.push('Está por debajo de tu metabolismo basal estimado ('+gpNum(r.energy.bmr)+' kcal). Hazlo solo con acompañamiento profesional.');
  const w=+(gProfDraft||GS.profile||{}).weight_kg;if(w&&(+v.protein_g/w<1.2||+v.protein_g/w>2.5))out.push(`La proteína equivale a ${gpNum(+v.protein_g/w,1)} g/kg; lo habitual con entrenamiento es 1,4–2,2 g/kg.`);
  return out.map(gesc).join(' ');
}

function vActiveTargets(){
  const t=gymActiveTarget(),p=GS.profile,d=t.details||{},c=d.computed||{};
  const hist=GS.targets.slice(0,10).map(x=>`<div class="row"><div class="g1"><b>${gpNum(x.kcal)} kcal · ${x.protein_g} g proteína</b><small>${gesc(fshort(String(x.created_at).slice(0,10)))} · ${({accepted:'Aceptado',manual:'Manual',superseded:'Reemplazado',proposed:'Propuesto'})[x.status]||x.status}</small></div></div>`).join('');
  const age=gymAgeFrom(p.birth_year);
  return `<section class="card gp-hero"><span class="hero-label">Tus objetivos diarios · ${t.status==='manual'?'definidos por ti':'aceptados'} el ${gesc(fshort(String(t.created_at).slice(0,10)))}</span>
    <div class="gp-kcal"><b>${gpNum(t.kcal)}</b><span>kcal al día</span></div>
    ${c.energy?`<p class="k">Mantenimiento estimado ${gpNum(c.energy.tdee)} kcal (rango ${gpRange(c.energy.tdeeRange)}).</p>`:''}
    ${gpTiles({protein:t.protein_g,carbs:t.carbs_g,fat:t.fat_g,fiber:t.fiber_g,water:(t.water_ml||0)/1000})}
    <div class="gp-res-actions"><button class="g" type="button" data-pact="explain">${gico('info',15)}<span>Ver cómo se calculó</span></button><button class="g" type="button" data-pact="edit">${gico('edit',15)}<span>Actualizar evaluación</span></button></div></section>
  <div class="cols"><section class="card"><h2>Tu evaluación</h2><div class="stats">
    <div><span class="k">Objetivo</span><b>${gesc(GYM_GOALS[p.goal]?.label||'—')}</b></div>
    <div><span class="k">Edad · estatura · peso</span><b>${age??'—'} años</b><small>${gpNum(p.height_cm,1)} cm · ${gpNum(p.weight_kg,1)} kg</small></div>
    <div><span class="k">Entrenamiento</span><b>${p.training_days} días</b><small>${p.session_min} min por sesión · ${gesc(GYM_EXPERIENCE[p.experience]?.label||'')}</small></div>
    <div><span class="k">Actividad diaria</span><b>${gesc(GYM_OCCUPATIONS[p.occupation]?.label||'')}</b><small>Caminata: ${gesc(GYM_WALKING[p.walking]?.label||'')}</small></div></div></section>
  <section class="card"><h2>Historial de objetivos</h2>${hist}</section></div>
  <section class="card"><h2>Tus datos</h2><p class="k">Tu evaluación y tus objetivos solo son visibles para tu cuenta. Puedes borrarlos cuando quieras; tus entrenamientos y medidas no se tocan.</p><button class="g danger" type="button" data-pact="deleteAll">${gico('x',15)}<span>Borrar evaluación y objetivos</span></button></section>`;
}

function vPerfil(){
  const gate=needAccount('tu evaluación');if(gate)return gate;
  if(gProfResult)return vProfileResult();
  if(gProfEdit)return vProfileWizard();
  if(GS.profile&&gymActiveTarget())return vActiveTargets();
  if(GS.profile){gProfResult=gymComputeTargets(gymProfileInput(GS.profile));return vProfileResult()}
  const intro=`<section class="card gp-intro">${gico('user',26)}<div><h2>Personaliza Gym en 2 minutos</h2><p class="k">Con unas preguntas sobre ti, tu actividad y tu objetivo, la app estima tu gasto energético y propone calorías, proteína, carbohidratos, grasas, fibra y agua. Verás el rango de incertidumbre y de dónde sale cada número.</p></div></section>`;
  return (GS.profileSchema===false?`<p class="sync-banner">${gico('cloud',16)}<span>Puedes completar la evaluación y ver el cálculo, pero aún no se guardará: falta aplicar la actualización de la base de datos de Gym.</span></p>`:'')+intro+vProfileWizard();
}

/* Tarjetas en otras secciones. */
function gProfileCta(){
  if(!signedIn()||!GS.ready||GS.profileSchema===null)return '';
  if(GS.profile&&gymActiveTarget())return '';
  return `<button type="button" class="card gp-cta" data-g="perfil">${gico('user',22)}<span><b>${GS.profile?'Revisa tus objetivos':'Haz tu evaluación inicial'}</b><small>Calorías, proteína y agua según tu cuerpo, tu actividad y tu objetivo</small></span>${gico('right',18)}</button>`;
}
function vNutricion(){
  const t=signedIn()&&GS.ready?gymActiveTarget():null;
  const targets=t?`<section class="card"><h2>Tus objetivos diarios</h2><div class="gp-kcal gp-kcal-sm"><b>${gpNum(t.kcal)}</b><span>kcal</span></div>${gpTiles({protein:t.protein_g,carbs:t.carbs_g,fat:t.fat_g,fiber:t.fiber_g,water:(t.water_ml||0)/1000})}<button class="lk" type="button" data-g="perfil">Ver o cambiar objetivos</button></section>`:(gProfileCta()||'');
  return targets+`<section class="card pending-card"><div class="pending-head">${gico('apple',26)}<div><h2>Registro de comidas ${phase('Próxima fase')}</h2><p class="k">Registrar alimentos y ver tu avance frente a estos objetivos llegará en la siguiente fase.</p></div></div></section>`;
}

/* ---- Eventos ---- */
function gpStepValid(){
  const fs=document.querySelector(`#fProfile .gp-step[data-step="${gProfStep}"]`);if(!fs)return true;
  for(const el of fs.querySelectorAll('input,select')){if(!el.checkValidity()){el.reportValidity();el.focus();return false}}
  return true;
}
function gpShowStep(){
  document.querySelectorAll('#fProfile .gp-step').forEach(f=>f.hidden=+f.dataset.step!==gProfStep);
  document.querySelectorAll('.gp-progress li').forEach((li,i)=>{li.classList.toggle('is-on',i===gProfStep);li.classList.toggle('is-done',i<gProfStep)});
  const nav=document.querySelector('#fProfile .gp-nav');
  if(nav)nav.innerHTML=(gProfStep>0?`<button type="button" class="g" data-pact="prev">${gico('back',15)}<span>Atrás</span></button>`:(GS.profile?`<button type="button" class="g" data-pact="cancelEdit">Cancelar</button>`:'<span></span>'))+
    (gProfStep<GP_STEPS.length-1?`<button type="button" class="b" data-pact="next"><span>Siguiente</span>${gico('right',15)}</button>`:`<button type="submit" class="b">${gico('check',15)}<span>Calcular mis objetivos</span></button>`);
  document.querySelector(`#fProfile .gp-step[data-step="${gProfStep}"] input`)?.focus();
}
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-pact]');if(!b)return;const a=b.dataset.pact;
  if(a==='next'){if(!gpStepValid())return;gProfStep=Math.min(GP_STEPS.length-1,gProfStep+1);sfx('tap');gpShowStep();return}
  if(a==='prev'){gProfStep=Math.max(0,gProfStep-1);gpShowStep();return}
  if(a==='edit'){gProfResult=null;gProfManual=false;gProfEdit=true;gProfStep=0;gRender(false);scrollTo(0,0);return}
  if(a==='cancelEdit'){gProfEdit=false;gProfDraft=null;gProfResult=null;gRender(false);return}
  if(a==='explain'){gProfResult=gymComputeTargets(gymProfileInput(GS.profile));gProfResult.explainOnly=true;gRender(false);document.querySelector('.gp-how')?.setAttribute('open','');return}
  if(a==='manual'){gProfManual=true;gRender(false);document.querySelector('#fManual input')?.focus();return}
  if(a==='manualCancel'){gProfManual=false;gRender(false);return}
  if(a==='accept'){
    if(!GS.profile){gToast('Guarda primero tu evaluación','error');return}
    const prev=gymActiveTarget(),ch=prev?gymTargetChange(prev.kcal,gProfResult.energy.kcal):null;
    if(ch!==null&&Math.abs(ch)>5&&!await ask(`El nuevo objetivo cambia un ${gpNum(Math.abs(ch),1)} % respecto al actual (${gpNum(prev.kcal)} → ${gpNum(gProfResult.energy.kcal)} kcal).`,{title:'¿Confirmas el cambio?',confirmLabel:'Sí, cambiar'}))return;
    b.disabled=true;const r=await gTry(()=>gymSaveTarget(gProfResult,{status:'accepted'}),'Objetivos guardados');b.disabled=false;
    if(r){sfx('success');gProfResult=null;gProfEdit=false;gProfDraft=null;gRender(false);scrollTo(0,0)}return}
  if(a==='deleteAll'){
    if(!await ask('Se borrarán tu evaluación inicial y todo el historial de objetivos. Tus entrenamientos, rutinas y medidas se conservan.',{title:'¿Borrar evaluación y objetivos?',confirmLabel:'Borrar',danger:true}))return;
    b.disabled=true;const ok=await gTry(()=>gymDeleteProfileData().then(()=>true),'Evaluación borrada');if(ok){sfx('delete');gProfResult=null;gProfEdit=false;gProfDraft=null;gProfStep=0}gRender(false);return}
});
document.addEventListener('input',e=>{
  const f=e.target.form;if(!f)return;
  if(f.id==='fProfile'){gProfDraft=gpReadForm(f);return}
  if(f.id==='fManual'&&gProfResult){const c=document.getElementById('manualCheck');if(c)c.innerHTML=gpManualCheck(gProfResult,Object.fromEntries(new FormData(f)))}
});
document.addEventListener('change',e=>{const f=e.target.form;if(f&&f.id==='fProfile')gProfDraft=gpReadForm(f)});
document.addEventListener('submit',async e=>{
  const f=e.target;if(f.id!=='fProfile'&&f.id!=='fManual')return;e.preventDefault();
  if(f.id==='fProfile'){
    if(!gpStepValid())return;
    if(gProfStep<GP_STEPS.length-1){gProfStep++;gpShowStep();return}
    const row=gpReadForm(f);gProfDraft=row;const input=gymProfileInput(row);const r=gymComputeTargets(input);
    if(!r.ok){gProfResult=r;gProfEdit=false;gRender(false);return}
    const btn=f.querySelector('[type=submit]');if(btn)btn.disabled=true;
    if(GS.profileSchema){const saved=await gTry(()=>gymSaveProfile(row));if(btn)btn.disabled=false;if(!saved)return}
    gProfResult=r;gProfEdit=false;gProfManual=false;sfx('success');gRender(false);scrollTo(0,0);return;
  }
  if(f.id==='fManual'){
    if(!f.reportValidity())return;
    if(!GS.profileSchema){await notify('Aún no se pueden guardar objetivos: falta aplicar la actualización de la base de datos de Gym.',{title:'No se pudo guardar'});return}
    const v=Object.fromEntries(new FormData(f)),manual={kcal:+v.kcal,protein_g:+v.protein_g,carbs_g:+v.carbs_g,fat_g:+v.fat_g,fiber_g:v.fiber_g===''?gProfResult.macros.fiber:+v.fiber_g,water_l:v.water_l===''?gProfResult.water.liters:+v.water_l};
    if(gProfResult.energy&&manual.kcal<gProfResult.energy.bmr&&!await ask('Las calorías que escribiste están por debajo de tu metabolismo basal estimado. Hazlo solo con acompañamiento profesional.',{title:'¿Guardar de todos modos?',confirmLabel:'Guardar'}))return;
    const btn=f.querySelector('[type=submit]');btn.disabled=true;const r=await gTry(()=>gymSaveTarget(gProfResult,{status:'manual',manual}),'Objetivos guardados');btn.disabled=false;
    if(r){sfx('success');gProfResult=null;gProfManual=false;gProfEdit=false;gProfDraft=null;gRender(false);scrollTo(0,0)}
  }
});
