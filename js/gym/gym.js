/* ---- Gym · interfaz ----
   Secciones con #hash. Fase 2: rutinas, entrenamiento con series, progreso y medidas guardados en
   Supabase (gym-store.js). Nutrición sigue pendiente. Requiere sesión iniciada en Mi Centro. */
const gesc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GI={
  home:'<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  dumbbell:'<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  chart:'<path d="M4 19V5m0 14h16"/><path d="m7 14 4-4 3 3 5-7"/>',
  body:'<circle cx="12" cy="5" r="2"/><path d="M7 9h10M12 9v6M9 21l3-6 3 6"/>',
  apple:'<path d="M12 8c-2-2-6-1.5-6 3.5S9 20 12 19c3 1 6-2.5 6-7.5S14 6 12 8z"/><path d="M12 8c0-2 1-3.5 3-4"/>',
  more:'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  back:'<path d="m15 6-6 6 6 6"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',right:'<path d="m9 6 6 6-6 6"/>',
  up:'<path d="m6 15 6-6 6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>',lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',flame:'<path d="M12 21c4 0 6.5-2.6 6.5-6.3 0-3.6-2.6-5.7-4-8.7-1 2.5-2.2 3.6-3.7 4.2.3-2.1-.4-4.2-2-6.2-.4 4.2-3.3 6.4-3.3 10.7C5.5 18.4 8 21 12 21z"/>',
  user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>',
  trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 21h6M10 17h4"/>',cloud:'<path d="M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 18z"/>'
};
const gico=(n,z=18)=>`<svg class="i" width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GI[n]||''}</svg>`;
const GYM_TABS=[['resumen','Resumen','Gym','home'],['rutinas','Rutinas','Rutinas','list'],['entrenar','Entrenar','Entrenamiento','dumbbell'],['progreso','Progreso','Progreso','chart'],['fisico','Físico','Seguimiento físico','body'],['nutricion','Nutrición','Nutrición','apple'],['perfil','Perfil','Tu evaluación y objetivos','user']];
const GYM_MORE=['fisico','nutricion','perfil'];
const DAYN=['D','L','M','X','J','V','S'],DAYL=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
let gProfStep=0,gProfResult=null,gProfEdit=false,gProfManual=false,gProfDraft=null;
let gtab='resumen',gData=null,gSummary=null,gAccount={state:'local',user:null},gEdit=null,gProgEx=null,gMapSel=null,gMapDays=7;

const phase=(txt)=>`<span class="chip chip-muted phase-chip">${gico('lock',13)} ${gesc(txt)}</span>`;
const fdate=d=>new Intl.DateTimeFormat('es-CO',{timeZone:GYM_TZ,weekday:'long',day:'numeric',month:'long'}).format(new Date(d+'T12:00:00-05:00'));
const fshort=d=>new Intl.DateTimeFormat('es-CO',{timeZone:GYM_TZ,day:'numeric',month:'short'}).format(new Date(d+'T12:00:00-05:00'));
const ftime=ts=>new Intl.DateTimeFormat('es-CO',{timeZone:GYM_TZ,hour:'numeric',minute:'2-digit'}).format(new Date(ts));
const kg=n=>(Math.round((+n||0)*10)/10).toLocaleString('es-CO')+' kg';
const vol=n=>Math.round(+n||0).toLocaleString('es-CO')+' kg';
const exName=id=>gymExercise(id)?.name||'Ejercicio eliminado';
const signedIn=()=>!!GS.user;

/* ---- Navegación ---- */
function gNavButton([k,n,,i]){return `<button type="button" class="${gtab===k?'on':''}" data-g="${k}" ${gtab===k?'aria-current="page"':''}>${gico(i,19)}<span>${n}</span></button>`}
function gNav(){
  document.getElementById('nav').innerHTML=GYM_TABS.map(gNavButton).join('');
  const T=k=>GYM_TABS.find(x=>x[0]===k),moreOn=GYM_MORE.includes(gtab);
  document.getElementById('tabbarItems').innerHTML=gNavButton(T('resumen'))+gNavButton(T('rutinas'))+
    `<button type="button" class="tab-add ${gtab==='entrenar'?'on':''}" data-g="entrenar" aria-label="Entrenamiento">${gico('dumbbell',24)}</button>`+gNavButton(T('progreso'))+
    `<button type="button" class="${moreOn?'on':''}" data-more ${moreOn?'aria-current="page"':''} aria-haspopup="dialog">${gico('more',19)}<span>${moreOn?gesc(T(gtab)[1]):'Más'}</span></button>`;
  document.getElementById('moreList').innerHTML=GYM_MORE.map(k=>{const [,n,,i]=T(k);return `<button type="button" class="more-item ${gtab===k?'on':''}" data-g="${k}">${gico(i,20)}<span>${n}</span>${gico('right',16)}</button>`}).join('')+
    `<a class="more-item" href="./index.html">${gico('back',20)}<span>Volver a Mi Centro de Control</span></a>`;
  requestAnimationFrame(gPlaceIndicators);
}
function gPlaceIndicators(){
  const on=document.querySelector('#nav button.on'),ind=document.querySelector('.nav-ind');
  if(ind&&on){ind.style.transform=`translateY(${on.offsetTop}px)`;ind.style.height=on.offsetHeight+'px';ind.style.opacity='1'}
  const bar=document.getElementById('tabbar'),tb=bar.querySelector('#tabbarItems button.on:not(.tab-add)'),ti=bar.querySelector('.tab-ind');
  if(ti){if(tb&&getComputedStyle(bar).display!=='none'){const r=tb.getBoundingClientRect(),p=bar.getBoundingClientRect();ti.style.transform=`translateX(${(r.left-p.left+r.width/2-ti.offsetWidth/2).toFixed(1)}px)`;ti.style.opacity='1'}else ti.style.opacity='0'}
}
addEventListener('resize',()=>requestAnimationFrame(gPlaceIndicators));
function gGo(k,{push=true}={}){
  if(!GYM_TABS.some(x=>x[0]===k))k='resumen';
  const changed=k!==gtab;gtab=k;
  if(push&&location.hash!=='#'+k)history.pushState(null,'','#'+k);
  gRender(changed);scrollTo(0,0);document.querySelector('#gymApp h1')?.focus({preventScroll:true});
}
addEventListener('popstate',()=>gGo(location.hash.slice(1)||'resumen',{push:false}));

/* ---- Bloques comunes ---- */
function needAccount(what){
  if(gAccount.state==='checking')return `<div class="empty">Comprobando tu sesión…</div>`;
  if(!signedIn())return `<section class="card gym-signin">${gico('cloud',26)}<div><h2>Inicia sesión para guardar ${gesc(what)}</h2><p class="k">Gym guarda rutinas, entrenamientos y medidas en tu cuenta de Mi Centro para que estén en todos tus dispositivos.</p><a class="b" href="./index.html#cuenta">Ir a Cuenta</a></div></section>`;
  if(GS.error&&!GS.ready)return `<section class="card gym-signin">${gico('cloud',26)}<div><h2>No se pudieron cargar tus datos</h2><p class="k">${gesc(GS.error)}</p><button class="b" type="button" data-act="reload">Reintentar</button></div></section>`;
  if(!GS.ready)return `<div class="empty">Cargando tus datos de Gym…</div>`;
  return '';
}
function syncBanner(){const n=gymPendingCount();return n?`<div class="sync-banner">${gico('cloud',16)}<span>${n} ${n===1?'entrenamiento pendiente':'entrenamientos pendientes'} de subir. Se enviará${n===1?'':'n'} al recuperar la conexión.</span><button class="lk" type="button" data-act="flush">Reintentar ahora</button></div>`:''}
function exerciseOptions(){const mine=GS.exercises.filter(e=>!e.archived).map(e=>e.name),set=new Set(mine.map(gymNorm));return [...mine,...GYM_CATALOG.map(c=>c.name).filter(n=>!set.has(gymNorm(n)))].map(n=>`<option value="${gesc(n)}">`).join('')}
/* Selector de músculo (los 20 del mapa), agrupados. */
function muscleOptions(blank){const groups={};GYM_MUSCLE_LIST.forEach(([id,name,group])=>{(groups[group]=groups[group]||[]).push([id,name])});return (blank?`<option value="">${blank}</option>`:'')+Object.entries(groups).map(([g,ms])=>`<optgroup label="${g}">${ms.map(([id,n])=>`<option value="${id}">${n}</option>`).join('')}</optgroup>`).join('')}
/* Formulario para añadir un ejercicio: si está en el catálogo se clasifica solo. */
function addExerciseForm(id,listId,btn){return `<form id="${id}" class="add-ex"><label class="fl">Ejercicio<input name="name" list="${listId}" maxlength="80" placeholder="Escribe o elige" required autocomplete="off"></label><datalist id="${listId}">${exerciseOptions()}</datalist>
  <label class="fl">Músculo principal<select name="primary">${muscleOptions('Automático (catálogo)')}</select></label><label class="fl">Secundario<select name="secondary">${muscleOptions('Ninguno')}</select></label><button class="g" type="submit">${gico('plus',15)}<span>${btn}</span></button></form>
  <p class="k add-ex-hint">Los ejercicios del catálogo traen su clasificación muscular. Si escribes uno nuevo, elige su músculo principal (y si quieres, uno secundario).</p>`}
function exerciseMuscleTags(id){const ex=gymExercise(id),{map}=gymExerciseMuscles(ex);return Object.entries(map).sort((a,b)=>a[1]===b[1]?0:a[1]==='P'?-1:1).map(([m,r])=>`<span class="tag ${r==='P'?'tag-p':''}">${gesc(GYM_MUSCLES_BY_ID[m].name)}</span>`).join('')}

/* ---- Resumen ---- */
function vResumen(){
  const s=gSummary,dn=['L','M','X','J','V','S','D'];
  const strip=s?s.week.map((d,i)=>`<li class="day ${d.done?'is-done':''} ${d.today?'is-today':''} ${d.planned&&!d.done?'is-planned':''}" aria-label="${gesc(fdate(d.date))}: ${d.done?'entrenaste':d.planned?(d.future?'programado':'sin marcar'):'sin registro'}"><span>${dn[i]}</span><i>${d.done?gico('check',14):''}</i></li>`).join(''):'';
  const heat=s?`<div class="heat" role="img" aria-label="Constancia de las últimas 12 semanas">${s.weeks.map(w=>`<div class="heat-col">${w.map(c=>`<i class="${c.future?'is-future':c.count?'lv'+Math.min(3,c.count):''}" title="${gesc(c.date)}${c.count?' · gimnasio':''}"></i>`).join('')}</div>`).join('')}</div><div class="heat-legend"><span>Hace 12 semanas</span><span>Esta semana</span></div>`:'';
  const hero=`<section class="card gym-hero">
    <div class="gym-hero-top"><div><span class="hero-label">Esta semana</span><div class="gym-hero-num"><b>${s?s.weekDone:0}</b><span>${s&&s.weekDone===1?'día de gimnasio':'días de gimnasio'}</span></div></div>
      <div class="gym-hero-side">${s&&s.streak?`<span class="chip chip-ok">${gico('flame',13)} ${s.streak} ${s.streak===1?'semana seguida':'semanas seguidas'}</span>`:''}<span class="k">${s&&s.lastDay?'Último: '+gesc(fdate(s.lastDay)):'Sin registros todavía'}</span></div></div>
    <ol class="week-strip">${strip}</ol>
    <p class="k gym-source">${gico('check',13)}<span>Días según <b>Mi día</b> (tareas «Gimnasio» hechas) y tus entrenamientos registrados aquí.</span></p>
  </section>`;
  const active=gymActive();
  const cta=active?`<button type="button" class="quick quick-live" data-g="entrenar">${gico('dumbbell',22)}<b>Continuar «${gesc(active.name)}»</b><span>Empezaste a las ${gesc(ftime(active.started_at))}</span></button>`:`<button type="button" class="quick quick-live" data-g="entrenar">${gico('dumbbell',22)}<b>Empezar a entrenar</b><span>Elige una rutina o entrena libre</span></button>`;
  const quick=`<section class="quick-grid" aria-label="Accesos rápidos">${cta}
    <button type="button" class="quick" data-g="rutinas">${gico('list',22)}<b>Rutinas</b><span>${signedIn()&&GS.ready?GS.routines.length+' guardada'+(GS.routines.length===1?'':'s'):'Crear y organizar'}</span></button>
    <button type="button" class="quick" data-g="progreso">${gico('chart',22)}<b>Progreso</b><span>Volumen y récords</span></button>
    <button type="button" class="quick" data-g="fisico">${gico('body',22)}<b>Peso y medidas</b><span>Registro corporal</span></button></section>`;
  let tiles='';
  if(signedIn()&&GS.ready){
    const st=gymStats(GS.sessions,GS.sets,GS.exercises,gymToday()),wt=gymWeightTrend(GS.metrics,gymToday());
    const dv=st.prevWeek.volume>0?Math.round((st.week.volume-st.prevWeek.volume)/st.prevWeek.volume*100):null;
    tiles=`<section class="card"><h2>Tu entrenamiento</h2><div class="stats">
      <div><span class="k">Entrenamientos esta semana</span><b>${st.week.sessions}</b><small>${st.totalSessions} en el último año</small></div>
      <div><span class="k">Volumen esta semana</span><b>${vol(st.week.volume)}</b><small>${dv===null?'Sin semana anterior para comparar':(dv>=0?'+':'')+dv+'% vs. semana pasada'}</small></div>
      <div><span class="k">Ejercicios con récord</span><b>${st.prs.length}</b><small>${st.prs[0]?'Mejor: '+gesc(st.prs[0].name):'Registra series para verlos'}</small></div>
      <div><span class="k">Peso corporal</span><b>${wt.latest?kg(wt.latest.weight_kg):'—'}</b><small>${wt.change===null?(wt.latest?'Necesita 2 mediciones en 30 días':'Sin mediciones'):(wt.change>0?'+':'')+wt.change+' kg en 30 días'}</small></div>
    </div></section>`;
  }else tiles=`<section class="card"><h2>Tu entrenamiento</h2>${needAccount('tus entrenamientos')||''}</section>`;
  const consist=`<section class="card"><h2>Constancia · 12 semanas</h2>${s&&s.hasAny?heat+`<p class="k">${s.last30} ${s.last30===1?'día':'días'} con gimnasio en los últimos 30 días.</p>`:'<div class="empty">Cuando entrenes o marques tareas de gimnasio en Mi día, aquí verás tu constancia semana a semana.</div>'}</section>`;
  return syncBanner()+hero+gProfileCta()+quick+`<div class="cols">${tiles}${consist}</div>`;
}

/* ---- Rutinas ---- */
function routineDays(r){return (r.days||[]).length?(r.days||[]).map(d=>DAYL[d]).join(' · '):'Sin días asignados'}
function vRutinas(){
  const gate=needAccount('tus rutinas');if(gate)return gate;
  if(gEdit)return vRoutineEditor();
  const today=new Date(gymToday()+'T12:00:00Z').getUTCDay();
  const list=GS.routines.length?GS.routines.map(r=>`<article class="card routine-card ${(r.days||[]).includes(today)?'is-today':''}"><div class="routine-head"><div><h2>${gesc(r.name)}${(r.days||[]).includes(today)?' <span class="chip chip-ok">Hoy</span>':''}</h2><p class="k">${gesc(routineDays(r))} · ${(r.items||[]).length} ${(r.items||[]).length===1?'ejercicio':'ejercicios'}</p></div><button class="b" type="button" data-act="startRoutine" data-id="${gesc(r.id)}">${gico('dumbbell',16)}<span>Entrenar</span></button></div>
    ${(r.items||[]).length?`<ol class="routine-items">${r.items.map(it=>`<li><b>${gesc(exName(it.exercise_id))}</b><span class="k">${it.sets} × ${it.reps_min}${it.reps_max!==it.reps_min?'–'+it.reps_max:''} · ${it.rest_s} s</span></li>`).join('')}</ol>`:'<p class="k">Sin ejercicios todavía.</p>'}
    <div class="goal-tools"><button class="g" type="button" data-act="editRoutine" data-id="${gesc(r.id)}">${gico('edit',15)}<span>Editar</span></button><button class="g danger" type="button" data-act="deleteRoutine" data-id="${gesc(r.id)}">Eliminar</button></div></article>`).join(''):`<div class="empty gym-empty"><b>Aún no tienes rutinas</b><span>Crea tu primera rutina con sus ejercicios, series y descansos.</span></div>`;
  return syncBanner()+`<div class="section-actions"><button class="b" type="button" data-act="newRoutine">${gico('plus',16)}<span>Nueva rutina</span></button></div>${list}`;
}
function vRoutineEditor(){
  const e=gEdit;
  const items=e.items.map((it,i)=>`<div class="ed-item" data-i="${i}"><div class="ed-item-head"><b>${gesc(exName(it.exercise_id))}</b><span class="ed-tags">${exerciseMuscleTags(it.exercise_id)}</span><span class="ed-move"><button class="g ic-b" type="button" data-act="itemUp" data-i="${i}" aria-label="Subir" ${i===0?'disabled':''}>${gico('up',15)}</button><button class="g ic-b" type="button" data-act="itemDown" data-i="${i}" aria-label="Bajar" ${i===e.items.length-1?'disabled':''}>${gico('down',15)}</button><button class="g ic-b" type="button" data-act="itemRemove" data-i="${i}" aria-label="Quitar ${gesc(exName(it.exercise_id))}">${gico('x',15)}</button></span></div>
    <div class="ed-fields"><label class="fl">Series<input type="number" min="1" max="20" inputmode="numeric" value="${it.sets}" data-item="${i}" data-k="sets"></label><label class="fl">Reps mín.<input type="number" min="1" max="100" inputmode="numeric" value="${it.reps_min}" data-item="${i}" data-k="reps_min"></label><label class="fl">Reps máx.<input type="number" min="1" max="100" inputmode="numeric" value="${it.reps_max}" data-item="${i}" data-k="reps_max"></label><label class="fl">Descanso (s)<input type="number" min="0" max="900" step="15" inputmode="numeric" value="${it.rest_s}" data-item="${i}" data-k="rest_s"></label></div></div>`).join('');
  return `<section class="card"><h2>${e.id?'Editar rutina':'Nueva rutina'}</h2>
    <label class="fl">Nombre<input id="edName" maxlength="60" placeholder="Ej. Empuje, Pierna, Torso" value="${gesc(e.name)}"></label>
    <fieldset class="days"><legend>Días de la semana</legend>${[1,2,3,4,5,6,0].map(d=>`<label><input type="checkbox" data-day="${d}" ${e.days.includes(d)?'checked':''}><span>${DAYL[d]}</span></label>`).join('')}</fieldset></section>
  <section class="card"><h2>Ejercicios</h2>${items||'<div class="empty">Agrega el primer ejercicio abajo.</div>'}
    ${addExerciseForm('fAddEx','exList','Agregar')}</section>
  <div class="section-actions sticky-actions"><button class="b" type="button" data-act="saveRoutine">Guardar rutina</button><button class="g" type="button" data-act="cancelRoutine">Cancelar</button></div>`;
}

/* ---- Entrenar ---- */
function vEntrenar(){
  const timer=`<section class="card timer-card"><h2>Temporizador de descanso</h2>
    <div class="timer"><div class="timer-ring" id="timerRing"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="52" stroke-width="8"/><circle class="ring-fg" id="timerArc" cx="60" cy="60" r="52" stroke-width="8" stroke-dasharray="326.73" stroke-dashoffset="0" transform="rotate(-90 60 60)"/></svg><b id="timerTxt" aria-live="polite">1:30</b></div>
      <div class="timer-controls"><div class="seg seg-wide" role="group" aria-label="Duración del descanso">${[60,90,120,180].map(s=>`<label><input type="radio" name="rest" value="${s}" ${s===gTimer.total?'checked':''}><span>${s<120?s+' s':(s/60)+' min'}</span></label>`).join('')}</div>
        <div class="timer-btns"><button class="b" type="button" data-timer="toggle" id="timerToggle">Iniciar descanso</button><button class="g" type="button" data-timer="reset">Reiniciar</button><button class="g" type="button" data-timer="plus">+15 s</button></div>
        <p class="k">Se inicia solo al marcar una serie como hecha. Al terminar suena un aviso${'vibrate' in navigator?' y vibra el teléfono':''}.</p></div></div></section>`;
  const gate=needAccount('tus entrenamientos');if(gate)return gate+timer;
  const w=gymActive();
  if(!w){
    const today=new Date(gymToday()+'T12:00:00Z').getUTCDay(),sorted=[...GS.routines].sort((a,b)=>((b.days||[]).includes(today)?1:0)-((a.days||[]).includes(today)?1:0));
    const hist=GS.sessions.slice(0,10).map(s=>{const ss=GS.sets.filter(x=>x.session_id===s.id),v=ss.reduce((a,x)=>a+(+x.weight_kg||0)*(+x.reps||0),0),mins=s.ended_at?Math.round((Date.parse(s.ended_at)-Date.parse(s.started_at))/60000):null;return `<div class="row"><span class="ti">${gico('dumbbell',16)}</span><div class="g1"><b>${gesc(s.name||'Entrenamiento')}</b><small>${gesc(fdate(gymDateOf(s.started_at)))} · ${ss.length} series · ${vol(v)}${mins!==null?' · '+mins+' min':''}</small></div><button class="g ic-b" type="button" data-act="deleteSession" data-id="${gesc(s.id)}" aria-label="Eliminar entrenamiento">${gico('x',15)}</button></div>`}).join('');
    return syncBanner()+`<section class="card"><h2>Empezar entrenamiento</h2>${sorted.length?sorted.map(r=>`<button type="button" class="pick-routine" data-act="startRoutine" data-id="${gesc(r.id)}"><span><b>${gesc(r.name)}</b><small class="k">${gesc(routineDays(r))} · ${(r.items||[]).length} ejercicios</small></span>${(r.days||[]).includes(today)?'<span class="chip chip-ok">Hoy</span>':''}${gico('right',16)}</button>`).join(''):'<p class="k">Aún no tienes rutinas. Puedes crear una o entrenar libre.</p>'}
      <div class="section-actions"><button class="g" type="button" data-act="startFree">${gico('plus',15)}<span>Entrenamiento libre</span></button>${GS.routines.length?'':'<button class="g" type="button" data-g="rutinas">Crear una rutina</button>'}</div></section>`+timer+
      `<section class="card"><h2>Últimos entrenamientos</h2>${hist||'<div class="empty">Aquí aparecerán tus entrenamientos al terminarlos.</div>'}</section>`;
  }
  const doneSets=w.exercises.reduce((a,e)=>a+e.sets.filter(s=>s.done).length,0),totalSets=w.exercises.reduce((a,e)=>a+e.sets.length,0);
  const cards=w.exercises.map((ex,ei)=>{
    const last=gymLastPerformance(ex.exercise_id,GS.sessions,GS.sets),t=ex.target||{};
    return `<section class="card ex-card"><div class="ex-head"><div><h2>${gesc(exName(ex.exercise_id))}</h2><div class="ex-tags">${exerciseMuscleTags(ex.exercise_id)}</div><p class="k">${t.sets?`Objetivo ${t.sets} × ${t.reps_min}${t.reps_max!==t.reps_min?'–'+t.reps_max:''} · descanso ${t.rest_s} s`:'Sin objetivo'}</p>${last?`<p class="last-time">${gico('trophy',13)} Última vez (${gesc(fshort(last.date))}): ${last.sets.map(s=>gesc((+s.weight_kg)+'×'+s.reps)).join(', ')}</p>`:'<p class="k">Primera vez con este ejercicio.</p>'}</div><button class="g ic-b" type="button" data-act="removeEx" data-ei="${ei}" aria-label="Quitar ejercicio">${gico('x',15)}</button></div>
      <div class="set-table"><div class="set-head"><span>Serie</span><span>Peso (kg)</span><span>Reps</span><span title="Esfuerzo percibido de 1 a 10 (opcional)">RPE</span><span>Hecha</span></div>
      ${ex.sets.map((s,si)=>`<div class="set-row ${s.done?'is-done':''}"><span>${si+1}</span><input type="number" inputmode="decimal" step="0.5" min="0" max="1000" value="${gesc(s.weight_kg)}" placeholder="kg" aria-label="Peso serie ${si+1}" data-ei="${ei}" data-si="${si}" data-k="weight_kg"><input type="number" inputmode="numeric" min="0" max="500" value="${gesc(s.reps)}" placeholder="${t.reps_min||''}" aria-label="Repeticiones serie ${si+1}" data-ei="${ei}" data-si="${si}" data-k="reps"><input type="number" inputmode="decimal" step="0.5" min="1" max="10" value="${gesc(s.rpe??'')}" placeholder="–" aria-label="RPE serie ${si+1} (opcional)" data-ei="${ei}" data-si="${si}" data-k="rpe"><input type="checkbox" ${s.done?'checked':''} aria-label="Serie ${si+1} hecha" data-ei="${ei}" data-si="${si}" data-k="done"></div>`).join('')}</div>
      <div class="ex-actions"><button class="lk" type="button" data-act="addSet" data-ei="${ei}">${gico('plus',14)} Añadir serie</button>${ex.sets.length>1?`<button class="lk" type="button" data-act="removeSet" data-ei="${ei}">Quitar última</button>`:''}</div></section>`}).join('');
  return `<section class="card live-shift on workout-head"><div class="live-head"><span class="live-dot" aria-hidden="true"></span><div><h2>${gesc(w.name)}</h2><p class="k">Empezaste a las ${gesc(ftime(w.started_at))} · ${doneSets} de ${totalSets} series hechas · se guarda en este dispositivo mientras entrenas</p></div></div>
    <div class="live-actions"><button class="b" type="button" data-act="finish">Terminar y guardar</button><button class="g" type="button" data-act="discard">Descartar</button></div></section>`+
    timer+cards+`<section class="card"><h2>Añadir ejercicio</h2>${addExerciseForm('fAddLive','exList2','Añadir')}</section>`;
}

/* ---- Progreso ---- */
function barsSvg(rows,{fmtV=v=>v,label}){
  const w=620,h=200,l=56,r=12,t=14,b=30,pw=w-l-r,ph=h-t-b,max=Math.max(1,...rows.map(x=>x.v)),step=pw/rows.length;
  const grid=[0,.5,1].map(k=>`<line x1="${l}" x2="${w-r}" y1="${t+ph-k*ph}" y2="${t+ph-k*ph}" stroke="var(--line)"/><text x="${l-8}" y="${t+ph-k*ph+4}" text-anchor="end" font-size="10" fill="var(--muted)">${gesc(fmtV(max*k))}</text>`).join('');
  const bars=rows.map((x,i)=>{const bh=x.v/max*ph,bx=l+i*step+step*.2,bw=step*.6;return `<rect x="${bx}" y="${t+ph-bh}" width="${bw}" height="${Math.max(x.v?2:0,bh)}" rx="4" fill="var(--accent)"><title>${gesc(x.label)}: ${gesc(fmtV(x.v))}</title></rect><text x="${l+i*step+step/2}" y="${h-10}" text-anchor="middle" font-size="10" fill="var(--muted)">${gesc(x.short)}</text>`}).join('');
  return `<svg class="insight-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${gesc(label)}">${grid}${bars}</svg>`;
}
function lineSvg(pts,{fmtV,label}){
  if(pts.length<2)return '<div class="empty">Hacen falta al menos dos registros para dibujar la evolución.</div>';
  const w=620,h=200,l=56,r=16,t=14,b=30,pw=w-l-r,ph=h-t-b,vs=pts.map(p=>p.v),min=Math.min(...vs),max=Math.max(...vs),span=max-min||1,lo=min-span*.15,hi=max+span*.15;
  const x=i=>l+(pts.length===1?pw/2:i*pw/(pts.length-1)),y=v=>t+ph-(v-lo)/(hi-lo)*ph;
  const grid=[lo,(lo+hi)/2,hi].map(v=>`<line x1="${l}" x2="${w-r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${l-8}" y="${y(v)+4}" text-anchor="end" font-size="10" fill="var(--muted)">${gesc(fmtV(v))}</text>`).join('');
  return `<svg class="insight-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${gesc(label)}">${grid}<polyline points="${pts.map((p,i)=>x(i)+','+y(p.v)).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${pts.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.v)}" r="4" fill="var(--accent)"><title>${gesc(p.label)}: ${gesc(fmtV(p.v))}</title></circle>`).join('')}<text x="${l}" y="${h-10}" font-size="10" fill="var(--muted)">${gesc(pts[0].short)}</text><text x="${w-r}" y="${h-10}" text-anchor="end" font-size="10" fill="var(--muted)">${gesc(pts.at(-1).short)}</text></svg>`;
}
function vProgreso(){
  const gate=needAccount('tu progreso');if(gate)return gate;
  const st=gymStats(GS.sessions,GS.sets,GS.exercises,gymToday());
  if(!st.hasData)return vMuscleMap()+`<div class="empty gym-empty"><b>Aún no hay series registradas</b><span>Termina tu primer entrenamiento y aquí verás volumen, récords y evolución de fuerza.</span><button class="b" type="button" data-g="entrenar">Empezar a entrenar</button></div>`;
  const volRows=st.weekly.map(w=>({v:w.volume,label:'Semana del '+fshort(w.week),short:fshort(w.week)}));
  const maxM=Math.max(1,...st.muscles.map(m=>m[1]));
  const exWithData=st.prs.filter(p=>p.bestE1rm!==null);if(!gProgEx||!exWithData.some(p=>p.exercise_id===gProgEx))gProgEx=exWithData[0]?.exercise_id||null;
  const sesById=new Map(GS.sessions.map(s=>[s.id,s]));
  const byDate=new Map();GS.sets.filter(s=>s.exercise_id===gProgEx&&sesById.has(s.session_id)).forEach(s=>{const d=gymDateOf(sesById.get(s.session_id).started_at),e=gymE1rm(s.weight_kg,s.reps);if(e!==null&&(!byDate.has(d)||e>byDate.get(d)))byDate.set(d,e)});
  const e1pts=[...byDate.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([d,v])=>({v,label:fdate(d),short:fshort(d)}));
  return vMuscleMap()+`<div class="report-grid">
    <section class="card"><h2>Volumen por semana</h2>${barsSvg(volRows,{fmtV:v=>Math.round(v/100)/10+' t',label:'Volumen semanal en toneladas'})}<p class="k">Suma de peso × repeticiones de las series hechas. Esta semana: ${vol(st.week.volume)} en ${st.week.sessions} ${st.week.sessions===1?'entrenamiento':'entrenamientos'}.</p></section>
    <section class="card"><h2>Series por grupo muscular · 30 días</h2>${st.muscles.length?st.muscles.map(([m,n])=>`<div class="cb"><span>${gesc(m)}</span><div class="bar"><i style="width:${(n/maxM*100).toFixed(1)}%"></i></div><span>${n} series</span></div>`).join(''):'<div class="empty">Sin series en los últimos 30 días.</div>'}</section>
    <section class="card"><h2>Fuerza estimada (1RM)</h2>${exWithData.length?`<label class="fl">Ejercicio<select id="progEx">${exWithData.map(p=>`<option value="${gesc(p.exercise_id)}" ${p.exercise_id===gProgEx?'selected':''}>${gesc(p.name)}</option>`).join('')}</select></label>${lineSvg(e1pts,{fmtV:v=>Math.round(v)+' kg',label:'Evolución del 1RM estimado'})}<p class="k">Estimación con la fórmula de Epley usando series de hasta 12 repeticiones. Es orientativa, no un máximo real.</p>`:'<div class="empty">Necesitas series de 1 a 12 repeticiones con peso para estimar tu fuerza.</div>'}</section>
    <section class="card"><h2>Récords personales</h2>${st.prs.slice(0,12).map(p=>`<div class="row"><span class="ti">${gico('trophy',16)}</span><div class="g1"><b>${gesc(p.name)}</b><small>${kg(p.bestWeight)} × ${p.bestWeightReps} · ${gesc(fshort(p.bestWeightDate))}${p.bestE1rm!==null?' · 1RM est. '+kg(p.bestE1rm):''}</small></div><span class="tag">${p.sets} series</span></div>`).join('')}</section>
  </div>`;
}

/* ---- Mapa muscular ---- */
function vMuscleMap(){
  const today=gymToday(),days=gMapDays,st=gymMuscleStats(GS.sessions,GS.sets,GS.exercises,gymDaysAgo(today,days-1),today),scale=7/days;
  const any=Object.values(st).some(m=>m.sets>0);
  if(!gMapSel||!st[gMapSel]){const top=Object.values(st).sort((a,b)=>b.weightedSets-a.weightedSets)[0];gMapSel=top&&top.sets?top.id:null}
  const sel=gMapSel?st[gMapSel]:null;
  let panel='<div class="empty">Toca un músculo del mapa para ver su detalle.</div>';
  if(sel){
    const tr=gymMuscleTrend(GS.sessions,GS.sets,GS.exercises,today,sel.id),band=gymStimulusBand(sel.weightedSets*scale);
    const assumed=sel.sets-sel.rpeKnown;
    panel=`<div class="mm-head"><div><h3>${gesc(sel.name)}</h3><span class="k">${gesc(sel.group)} · últimos ${days} días</span></div><span class="chip mm-band b${band}">${GYM_BANDS[band].split(' (')[0]}</span></div>
      ${sel.sets?`<div class="stats mm-stats">
        <div><span class="k">Series</span><b>${sel.sets}</b><small>${sel.primarySets} como principal · ${sel.secondarySets} como secundario</small></div>
        <div><span class="k">Estímulo estimado</span><b>${sel.weightedSets}</b><small>series ponderadas${days!==7?' · ≈ '+(Math.round(sel.weightedSets*scale*10)/10)+' por semana':''}</small></div>
        <div><span class="k">Volumen de carga</span><b>${vol(sel.volume)}</b><small>peso × reps × participación</small></div>
        <div><span class="k">Sesiones</span><b>${sel.sessions}</b><small>${sel.dates.length?'Última: '+gesc(fshort(sel.dates.at(-1))):''}</small></div></div>
      <h4>Ejercicios que lo estimularon</h4>${sel.exercises.map(e=>`<div class="row"><div class="g1"><b>${gesc(e.name)}</b><small>${e.role==='P'?'Principal (cuenta 1 por serie)':'Secundario (cuenta 0,5 por serie)'} · ${vol(e.volume)}</small></div><span class="tag ${e.role==='P'?'tag-p':''}">${e.sets} series</span></div>`).join('')}
      <h4>Historial</h4><p class="k">${sel.dates.map(d=>gesc(fshort(d))).join(' · ')}</p>
      ${assumed?`<p class="k">${assumed} ${assumed===1?'serie no tiene':'series no tienen'} RPE: se contaron como esfuerzo suficiente.</p>`:''}`:'<div class="empty">No entrenaste este músculo en este periodo.</div>'}
      <h4>Tendencia de entrenamiento (4 semanas vs. 4 anteriores)</h4><p class="mm-trend ${tr.tone}">${gesc(tr.label)}</p>
      ${tr.strength.length?tr.strength.map(x=>`<div class="row"><div class="g1"><b>${gesc(x.name)}</b><small>1RM estimado ${kg(x.before)} → ${kg(x.now)}</small></div><span class="tag ${x.change>0?'tag-p':''}">${x.change>0?'+':''}${x.change}%</span></div>`).join(''):''}
      <p class="k">Es un indicador de cuánto y con qué carga lo entrenas, <b>no una medición de crecimiento muscular</b>.</p>`;
  }
  const legend=GYM_BANDS.map((t,i)=>`<span><i class="bm-key bm-b${i}"></i>${gesc(t)}</span>`).join('');
  return `<section class="card muscle-map"><div class="mm-top"><h2>Mapa muscular</h2><div class="seg" role="group" aria-label="Periodo">${[7,30].map(d=>`<label><input type="radio" name="mapDays" value="${d}" ${d===days?'checked':''}><span>${d} días</span></label>`).join('')}</div></div>
    ${any?'':'<p class="k">Aún no hay series en este periodo: el mapa se colorea al terminar entrenamientos.</p>'}
    <div class="mm-body"><div class="mm-figs">${gymBodyMapSvg('front',st,{scale,selected:gMapSel})}${gymBodyMapSvg('back',st,{scale,selected:gMapSel})}</div><div class="mm-panel" aria-live="polite">${panel}</div></div>
    <div class="bm-legend">${legend}</div>
    <p class="k">Color según series ponderadas por semana: 1 por serie si el músculo es principal y 0,5 si es secundario (conteo fraccional, Pelland et al. 2024); series con RPE menor de 7 cuentan la mitad.</p></section>`;
}
/* ---- Físico ---- */
const METRIC_FIELDS=[['weight_kg','Peso','kg',0.1],['body_fat','% grasa','%',0.1],['waist_cm','Cintura','cm',0.5],['chest_cm','Pecho','cm',0.5],['arm_cm','Brazo','cm',0.5],['thigh_cm','Pierna','cm',0.5],['hip_cm','Cadera','cm',0.5]];
function vFisico(){
  const gate=needAccount('tus medidas');if(gate)return gate;
  const today=gymToday(),cur=GS.metrics.find(m=>m.date===today)||{},wt=gymWeightTrend(GS.metrics,today,90);
  const pts=[...GS.metrics].filter(m=>m.weight_kg!==null).sort((a,b)=>a.date.localeCompare(b.date)).slice(-30).map(m=>({v:+m.weight_kg,label:fdate(m.date),short:fshort(m.date)}));
  return `<section class="card"><h2>Registrar medidas</h2><form id="fMetric" class="metric-form">
    <label class="fl">Fecha<input type="date" name="date" value="${today}" max="${today}" required></label>
    ${METRIC_FIELDS.map(([k,n,u,st])=>`<label class="fl">${n} (${u})<input type="number" name="${k}" step="${st}" inputmode="decimal" value="${cur[k]??''}"></label>`).join('')}
    <label class="fl wide">Notas<input name="notes" maxlength="300" value="${gesc(cur.notes||'')}" placeholder="Opcional"></label>
    <button class="b">Guardar medidas</button></form><p class="k">Una fila por día: si ya registraste hoy, se actualiza. Deja vacío lo que no midas.</p></section>
  <div class="cols"><section class="card"><h2>Peso corporal</h2>${lineSvg(pts,{fmtV:v=>(Math.round(v*10)/10)+' kg',label:'Evolución del peso corporal'})}${wt.change!==null?`<p class="k">${(wt.change>0?'+':'')+wt.change} kg en los últimos 90 días (${wt.points} mediciones).</p>`:''}</section>
  <section class="card"><h2>Historial</h2>${GS.metrics.length?GS.metrics.slice(0,20).map(m=>`<div class="row"><div class="g1"><b>${gesc(fdate(m.date))}</b><small>${METRIC_FIELDS.filter(([k])=>m[k]!==null&&m[k]!==undefined).map(([k,n,u])=>n+' '+(+m[k])+' '+u).join(' · ')||'Sin medidas'}</small></div><button class="g ic-b" type="button" data-act="deleteMetric" data-id="${gesc(m.id)}" aria-label="Eliminar medición del ${gesc(m.date)}">${gico('x',15)}</button></div>`).join(''):'<div class="empty">Aún no hay mediciones.</div>'}</section></div>`;
}
/* vNutricion y vPerfil están en gym-perfil.js. */
function gRender(animate){
  const T=GYM_TABS.find(x=>x[0]===gtab),app=document.getElementById('gymApp');
  const keep=document.activeElement&&app.contains(document.activeElement)&&document.activeElement.matches('input,select')?{sel:document.activeElement.dataset.item!==undefined?`[data-item="${document.activeElement.dataset.item}"][data-k="${document.activeElement.dataset.k}"]`:document.activeElement.id?'#'+document.activeElement.id:null}:null;
  document.title=(gtab==='resumen'?'Gym':T[2]+' · Gym')+' · Mi Centro de Control';
  gNav();
  app.innerHTML=`<div class="ph"><h1 tabindex="-1">${gesc(T[2])}</h1>${gtab==='resumen'?'<p>Tu entrenamiento, conectado con Mi Centro de Control.</p>':''}</div>`+({resumen:vResumen,rutinas:vRutinas,entrenar:vEntrenar,progreso:vProgreso,fisico:vFisico,nutricion:vNutricion,perfil:vPerfil}[gtab])();
  if(gtab==='entrenar')gTimerPaint();
  if(keep?.sel)app.querySelector(keep.sel)?.focus();
  if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){app.classList.remove('stagger');void app.offsetWidth;[...app.children].forEach((el,i)=>el.style.setProperty('--i',Math.min(i,8)));app.classList.add('stagger');setTimeout(()=>app.classList.remove('stagger'),1400)}
}

/* ---- Temporizador de descanso (no guarda datos) ---- */
const gTimer={total:90,left:90,running:false,endAt:0,iv:null};
function gTimerPaint(){
  const t=document.getElementById('timerTxt'),arc=document.getElementById('timerArc'),btn=document.getElementById('timerToggle');if(!t)return;
  const s=Math.max(0,Math.ceil(gTimer.left));t.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  arc.style.strokeDashoffset=(326.73*(1-Math.min(1,gTimer.left/gTimer.total))).toFixed(2);
  btn.textContent=gTimer.running?'Pausar':gTimer.left<gTimer.total&&gTimer.left>0?'Continuar':'Iniciar descanso';
  document.getElementById('timerRing').classList.toggle('done',gTimer.left<=0);
}
function gTimerTick(){
  gTimer.left=(gTimer.endAt-Date.now())/1000;
  if(gTimer.left<=0){gTimer.left=0;gTimerStop();gToast('Descanso terminado: siguiente serie');sfx('success');try{navigator.vibrate?.([200,100,200])}catch(e){}}
  gTimerPaint();
}
function gTimerStart(seconds){if(seconds){gTimer.total=gTimer.left=seconds}if(gTimer.left<=0)gTimer.left=gTimer.total;gTimer.running=true;gTimer.endAt=Date.now()+gTimer.left*1000;clearInterval(gTimer.iv);gTimer.iv=setInterval(gTimerTick,250);gTimerPaint()}
function gTimerStop(){gTimer.running=false;clearInterval(gTimer.iv);gTimer.iv=null}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&gTimer.running)gTimerTick()});
let _gt;function gToast(m,kind){const t=document.getElementById('toast');t.textContent=m;t.dataset.kind=kind||'';t.className='';void t.offsetWidth;t.className='show';clearTimeout(_gt);_gt=setTimeout(()=>t.className='',3200)}
async function gTry(fn,okMsg){try{const r=await fn();if(okMsg)gToast(okMsg);return r}catch(e){sfx('error');await notify(gymErr(e),{title:'No se pudo completar'});return null}}

/* ---- Eventos ---- */
document.addEventListener('click',async e=>{
  const g=e.target.closest('[data-g]');if(g){document.querySelectorAll('dialog.sheet[open]').forEach(d=>d.close());sfx('tap');gGo(g.dataset.g);return}
  if(e.target.closest('[data-more]')){sfx('open');document.getElementById('moreSheet').showModal();return}
  if(e.target.closest('dialog.sheet [data-close]')){e.target.closest('dialog').close();return}
  if(e.target.matches('dialog.sheet[open]')){e.target.close();return}
  const tm=e.target.closest('[data-timer]');
  if(tm){const a=tm.dataset.timer;if(a==='toggle'){if(gTimer.running){gTimerTick();gTimerStop();gTimerPaint()}else{gTimerStart();sfx('tap')}}else if(a==='reset'){gTimerStop();gTimer.left=gTimer.total;gTimerPaint()}else if(a==='plus'){gTimer.left=Math.max(0,gTimer.left)+15;gTimer.total=Math.max(gTimer.total,gTimer.left);if(gTimer.running)gTimer.endAt=Date.now()+gTimer.left*1000;gTimerPaint()}return}
  const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act,id=b.dataset.id;
  if(a==='reload'){await gymBoot();return}
  if(a==='flush'){await gymFlushQueue();gRender(false);gToast(gymPendingCount()?'Aún sin conexión':'Entrenamientos subidos');return}
  if(a==='newRoutine'){gEdit={id:null,name:'',days:[],items:[]};gRender(false);document.getElementById('edName')?.focus();return}
  if(a==='editRoutine'){const r=GS.routines.find(x=>x.id===id);if(r){gEdit={id:r.id,name:r.name,days:[...(r.days||[])],items:JSON.parse(JSON.stringify(r.items||[])),position:r.position};gRender(false);scrollTo(0,0)}return}
  if(a==='cancelRoutine'){gEdit=null;gRender(false);return}
  if(a==='itemUp'||a==='itemDown'){const i=+b.dataset.i,j=a==='itemUp'?i-1:i+1;if(j<0||j>=gEdit.items.length)return;[gEdit.items[i],gEdit.items[j]]=[gEdit.items[j],gEdit.items[i]];gRender(false);return}
  if(a==='itemRemove'){gEdit.items.splice(+b.dataset.i,1);gRender(false);return}
  if(a==='saveRoutine'){gEdit.name=document.getElementById('edName')?.value||gEdit.name;if(!gEdit.name.trim()){await notify('Ponle un nombre a la rutina.',{title:'Falta el nombre'});return}if(!gEdit.items.length){await notify('Agrega al menos un ejercicio.',{title:'Rutina vacía'});return}if(GS.busy)return;b.disabled=true;const r=await gTry(()=>gymSaveRoutine(gEdit),'Rutina guardada');b.disabled=false;if(r){sfx('success');gEdit=null;gRender(false)}return}
  if(a==='deleteRoutine'){const r=GS.routines.find(x=>x.id===id);if(!r)return;if(!await ask('Se borrará la rutina. Los entrenamientos que ya hiciste con ella se conservan en tu historial.',{title:'¿Eliminar «'+r.name+'»?',confirmLabel:'Eliminar',danger:true}))return;b.disabled=true;const ok=await gTry(()=>gymDeleteRoutine(id).then(()=>true),'Rutina eliminada');if(ok)sfx('delete');gRender(false);return}
  if(a==='startRoutine'||a==='startFree'){if(!GS.ready){gToast('Tus datos aún se están cargando','error');return}if(gymActive()&&!await ask('Ya tienes un entrenamiento en curso. Si empiezas otro, el actual se descarta.',{title:'¿Empezar otro entrenamiento?',confirmLabel:'Empezar otro',danger:true}))return;gymStartWorkout(a==='startRoutine'?GS.routines.find(x=>x.id===id):null);sfx('open');gGo('entrenar');return}
  if(a==='addSet'){const w=gymActive(),ex=w.exercises[+b.dataset.ei],last=ex.sets.at(-1);ex.sets.push({id:gymUid(),weight_kg:last?.weight_kg??'',reps:'',done:false});gymSetActive(w);gRender(false);return}
  if(a==='removeSet'){const w=gymActive(),ex=w.exercises[+b.dataset.ei];if(ex.sets.length>1)ex.sets.pop();gymSetActive(w);gRender(false);return}
  if(a==='removeEx'){const w=gymActive(),ex=w.exercises[+b.dataset.ei];if(ex.sets.some(s=>s.done)&&!await ask('Las series hechas de este ejercicio no se guardarán.',{title:'¿Quitar «'+exName(ex.exercise_id)+'»?',confirmLabel:'Quitar',danger:true}))return;w.exercises.splice(+b.dataset.ei,1);gymSetActive(w);gRender(false);return}
  if(a==='discard'){if(!gymActive()){gRender(false);return}if(!await ask('Se perderán las series de este entrenamiento. Tus entrenamientos anteriores y tus rutinas no se tocan.',{title:'¿Descartar el entrenamiento en curso?',confirmLabel:'Descartar',cancelLabel:'Seguir entrenando',danger:true}))return;gymDiscardWorkout();gTimerStop();sfx('delete');gToast('Entrenamiento descartado');gRender(false);return}
  if(a==='finish'){
    const w=gymActive();if(!w){gToast('No hay un entrenamiento en curso','error');gRender(false);return}
    const n=w.exercises.reduce((x,e)=>x+e.sets.filter(s=>s.done).length,0);
    if(!n&&!await ask('No marcaste ninguna serie como hecha: se guardará el entrenamiento sin series.',{title:'¿Terminar sin series?',confirmLabel:'Terminar'}))return;
    b.disabled=true;const r=await gymFinishWorkout();gRefreshSummary();gTimerStop();gRender(false);
    if(r.saved){sfx('success');await notify(`${r.minutes} min · ${r.exercises} ${r.exercises===1?'ejercicio':'ejercicios'} · ${r.sets} series · ${vol(r.volume)} de volumen. Ya aparece en tu historial y en tu progreso.`,{title:'Entrenamiento guardado'})}
    else if(r.queued){sfx('tap');await notify('No se pudo subir ahora ('+(GS.error||'sin conexión')+'). Quedó guardado en este dispositivo y se enviará automáticamente.',{title:'Pendiente de subir'})}
    return}
  if(a==='deleteSession'){if(!await ask('Se borrarán el entrenamiento y sus series. Tus récords se recalculan.',{title:'¿Eliminar entrenamiento?',confirmLabel:'Eliminar',danger:true}))return;await gTry(()=>gymDeleteSession(id),'Entrenamiento eliminado');gRefreshSummary();sfx('delete');gRender(false);return}
  if(a==='deleteMetric'){if(!await ask('Se borrará esa medición.',{title:'¿Eliminar medición?',confirmLabel:'Eliminar',danger:true}))return;await gTry(()=>gymDeleteMetric(id),'Medición eliminada');gRender(false);return}
});
/* Solo los formularios propios de Gym. Los diálogos de confirmación (<form method="dialog">) deben
   enviarse con normalidad: si se bloquean, el diálogo nunca se cierra y la acción que espera la
   respuesta (eliminar, descartar, terminar…) se queda colgada. */
const GYM_FORMS=['fAddEx','fAddLive','fMetric'];
document.addEventListener('submit',async e=>{
  const f=e.target;if(!GYM_FORMS.includes(f.id))return;
  e.preventDefault();const v=Object.fromEntries(new FormData(f));
  if(f.id==='fAddEx'||f.id==='fAddLive'){
    const btn=f.querySelector('button');btn.disabled=true;
    const ex=await gTry(()=>gymEnsureExercise(v.name,{primary:v.primary||null,secondary:v.secondary||null}));btn.disabled=false;if(!ex)return;
    if(f.id==='fAddEx'){gEdit.name=document.getElementById('edName')?.value||gEdit.name;gEdit.items.push({exercise_id:ex.id,sets:3,reps_min:8,reps_max:12,rest_s:90,notes:''})}else gymAddExerciseToActive(ex.id);
    sfx('check');gRender(false);(document.querySelector('#fAddEx input[name=name]')||document.querySelector('#fAddLive input[name=name]'))?.focus();return;
  }
  if(f.id==='fMetric'){const btn=f.querySelector('button');btn.disabled=true;const r=await gTry(()=>gymSaveMetric(v),'Medidas guardadas');btn.disabled=false;if(r){sfx('success');gRender(false)}}
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='edName'&&gEdit){gEdit.name=t.value;return}
  if(t.dataset.item!==undefined&&gEdit){gEdit.items[+t.dataset.item][t.dataset.k]=t.value;return}
  if(t.dataset.ei!==undefined&&t.dataset.k&&t.type!=='checkbox'){const w=gymActive();if(!w)return;w.exercises[+t.dataset.ei].sets[+t.dataset.si][t.dataset.k]=t.value;gymSetActive(w)}
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.name==='rest'){gTimerStop();gTimer.total=gTimer.left=+t.value;gTimerPaint();return}
  if(t.dataset.day!==undefined&&gEdit){const d=+t.dataset.day;gEdit.days=t.checked?[...new Set([...gEdit.days,d])]:gEdit.days.filter(x=>x!==d);return}
  if(t.id==='progEx'){gProgEx=t.value;gRender(false);return}
  if(t.name==='mapDays'){gMapDays=+t.value;gRender(false);return}
  if(t.dataset.k==='done'){
    const w=gymActive();if(!w)return;const ex=w.exercises[+t.dataset.ei],s=ex.sets[+t.dataset.si];
    if(t.checked&&(s.reps===''||s.reps===null)){s.reps=String(ex.target?.reps_min||'')}
    if(t.checked&&!(+s.reps>=0&&String(s.reps)!=='')){t.checked=false;gToast('Escribe las repeticiones antes de marcarla','error');return}
    s.done=t.checked;gymSetActive(w);sfx(t.checked?'check':'uncheck');
    if(t.checked&&ex.target?.rest_s)gTimerStart(ex.target.rest_s);
    gRender(false);
  }
});

/* Semana y constancia: Mi día + entrenamientos registrados en Gym. */
function gRefreshSummary(){gSummary=gymSummary(gData,GS.ready?GS.sessions.map(s=>gymDateOf(s.started_at)):[])}
/* ---- Arranque ---- */
async function gymBoot(){
  gAccount=await gymSession();GS.user=gAccount.user;
  const pill=document.getElementById('gymAccount'),label=pill.querySelector('span');
  const M={signed:['saved','Sesión iniciada'],local:['local','Sin sesión'],offline:['offline','Sin conexión'],error:['error','No se pudo comprobar la sesión']}[gAccount.state]||['local',''];
  pill.dataset.state=M[0];label.textContent=M[1];pill.title=gAccount.user?.email?'Sesión: '+gAccount.user.email:M[1];
  if(gAccount.user){const d=gymReadLocalData(gAccount.user.id);if(d){gData=d;gSummary=gymSummary(gData)}}
  gRender(false);
  if(GS.user){await gymFlushQueue();await gymLoadAll();await gymLoadProfile();await gymLoadNutrition();await gymLoadCustomFoods();gRefreshSummary();gRender(false)}
}
document.querySelectorAll('dialog.sheet [data-close]').forEach(b=>b.innerHTML=gico('x',16));
document.getElementById('gymDate').textContent=new Intl.DateTimeFormat('es-CO',{timeZone:GYM_TZ,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
gtab=GYM_TABS.some(x=>x[0]===location.hash.slice(1))?location.hash.slice(1):'resumen';
gAccount={state:'checking',user:null};
gData=gymReadLocalData(null);gSummary=gymSummary(gData);gRender(true);
gymBoot();
