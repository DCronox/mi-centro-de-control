/* ---- Gym · interfaz (Fase 1) ----
   Navegación por secciones con #hash (el botón Atrás del navegador funciona), panel con datos reales
   de «Mi día» (categoría Gimnasio) y temporizador de descanso funcional. Las secciones sin lógica
   todavía se muestran como «Fase 2» y no guardan nada. */
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
  timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>',lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',flame:'<path d="M12 21c4 0 6.5-2.6 6.5-6.3 0-3.6-2.6-5.7-4-8.7-1 2.5-2.2 3.6-3.7 4.2.3-2.1-.4-4.2-2-6.2-.4 4.2-3.3 6.4-3.3 10.7C5.5 18.4 8 21 12 21z"/>'
};
const gico=(n,z=18)=>`<svg class="i" width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GI[n]||''}</svg>`;
const GYM_TABS=[['resumen','Resumen','Gym','home'],['rutinas','Rutinas','Rutinas','list'],['entrenar','Entrenar','Entrenamiento activo','dumbbell'],['progreso','Progreso','Progreso','chart'],['fisico','Físico','Seguimiento físico','body'],['nutricion','Nutrición','Nutrición','apple']];
const GYM_MORE=['fisico','nutricion'];
let gtab='resumen',gData=null,gSummary=null,gAccount={state:'local',user:null};

const phase2=(txt='Disponible en la Fase 2')=>`<span class="chip chip-muted phase-chip">${gico('lock',13)} ${gesc(txt)}</span>`;
const fdate=d=>new Intl.DateTimeFormat('es-CO',{timeZone:GYM_TZ,weekday:'long',day:'numeric',month:'long'}).format(new Date(d+'T12:00:00-05:00'));

/* ---- Navegación ---- */
function gNavButton([k,n,,i]){return `<button type="button" class="${gtab===k?'on':''}" data-g="${k}" ${gtab===k?'aria-current="page"':''}>${gico(i,19)}<span>${n}</span></button>`}
function gNav(){
  document.getElementById('nav').innerHTML=GYM_TABS.map(gNavButton).join('');
  const T=k=>GYM_TABS.find(x=>x[0]===k),moreOn=GYM_MORE.includes(gtab);
  document.getElementById('tabbarItems').innerHTML=gNavButton(T('resumen'))+gNavButton(T('rutinas'))+
    `<button type="button" class="tab-add ${gtab==='entrenar'?'on':''}" data-g="entrenar" aria-label="Entrenamiento activo">${gico('dumbbell',24)}</button>`+gNavButton(T('progreso'))+
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

/* ---- Secciones ---- */
function vResumen(){
  const s=gSummary,dn=['L','M','X','J','V','S','D'];
  const strip=s?s.week.map((d,i)=>`<li class="day ${d.done?'is-done':''} ${d.today?'is-today':''} ${d.planned&&!d.done?'is-planned':''}" aria-label="${gesc(fdate(d.date))}: ${d.done?'entrenaste':d.planned?(d.future?'programado':'sin marcar'):'sin registro'}"><span>${dn[i]}</span><i>${d.done?gico('check',14):''}</i></li>`).join(''):'';
  const heat=s?`<div class="heat" role="img" aria-label="Constancia de las últimas 12 semanas: ${s.last30} días con gimnasio en los últimos 30 días">${s.weeks.map(w=>`<div class="heat-col">${w.map(c=>`<i class="${c.future?'is-future':c.count?'lv'+Math.min(3,c.count):''}" title="${gesc(c.date)}${c.count?' · gimnasio':''}"></i>`).join('')}</div>`).join('')}</div><div class="heat-legend"><span>Hace 12 semanas</span><span>Esta semana</span></div>`:'';
  const hero=`<section class="card gym-hero">
    <div class="gym-hero-top"><div><span class="hero-label">Esta semana</span><div class="gym-hero-num"><b>${s?s.weekDone:0}</b><span>${s&&s.weekDone===1?'día de gimnasio':'días de gimnasio'}</span></div></div>
      <div class="gym-hero-side">${s&&s.streak?`<span class="chip chip-ok">${gico('flame',13)} ${s.streak} ${s.streak===1?'semana seguida':'semanas seguidas'}</span>`:''}<span class="k">${s&&s.lastDay?'Último: '+gesc(fdate(s.lastDay)):'Sin registros todavía'}</span></div></div>
    <ol class="week-strip">${strip}</ol>
    <p class="k gym-source">${gico('check',13)}<span>Datos reales de <b>Mi día</b>: tareas con categoría «Gimnasio» marcadas como hechas en este dispositivo.</span></p>
  </section>`;
  const empty=s&&!s.hasAny?`<div class="empty gym-empty"><b>Aún no hay entrenamientos registrados</b><span>Mientras llega el registro de entrenamientos, crea en Mi día una tarea o rutina con categoría «Gimnasio» y márcala al terminar: aparecerá aquí.</span><a class="b" href="./index.html#dia">Ir a Mi día</a></div>`:'';
  const quick=`<section class="quick-grid" aria-label="Accesos rápidos">
    <button type="button" class="quick" data-g="entrenar">${gico('timer',22)}<b>Temporizador de descanso</b><span>Funciona ya</span></button>
    <button type="button" class="quick" data-g="rutinas">${gico('list',22)}<b>Rutinas</b><span>Fase 2</span></button>
    <button type="button" class="quick" data-g="progreso">${gico('chart',22)}<b>Progreso</b><span>Fase 2</span></button>
    <button type="button" class="quick" data-g="fisico">${gico('body',22)}<b>Peso y medidas</b><span>Fase 2</span></button>
  </section>`;
  const tiles=`<section class="card"><h2>Indicadores del entrenamiento ${phase2('Se activan con la Fase 2')}</h2><div class="stats pending-stats">
    <div><span class="k">Volumen semanal</span><b>—</b><small>kg × repeticiones</small></div>
    <div><span class="k">Récords personales</span><b>—</b><small>por ejercicio</small></div>
    <div><span class="k">Peso corporal</span><b>—</b><small>última medición</small></div>
    <div><span class="k">Proteína de hoy</span><b>—</b><small>frente a tu objetivo</small></div>
  </div><p class="k">Ninguno de estos valores se calcula todavía: se mostrarán cuando registres entrenamientos, medidas y comidas.</p></section>`;
  const consist=`<section class="card"><h2>Constancia · 12 semanas</h2>${s&&s.hasAny?heat+`<p class="k">${s.last30} ${s.last30===1?'día':'días'} con gimnasio en los últimos 30 días.</p>`:'<div class="empty">Cuando marques tareas de gimnasio en Mi día, aquí verás tu constancia semana a semana.</div>'}</section>`;
  const routines=s&&s.routines.length?`<section class="card"><h2>Tus rutinas de gimnasio en Mi día</h2>${s.routines.map(r=>`<div class="row"><span class="ti">${gico('dumbbell',16)}</span><div class="g1"><b>${gesc(r.name)}</b><small>${['D','L','M','X','J','V','S'].map((n,i)=>Array.isArray(r.days)&&r.days.includes(i)?n:'·').join(' ')}${r.time?' · '+gesc(r.time):''}</small></div></div>`).join('')}</section>`:'';
  return hero+empty+quick+`<div class="cols">${consist}${tiles}</div>`+routines;
}
function vRutinas(){
  return `<section class="card pending-card"><div class="pending-head">${gico('list',26)}<div><h2>Tus rutinas ${phase2()}</h2><p class="k">Aquí crearás rutinas por días (por ejemplo «Empuje», «Tirón», «Pierna») con sus ejercicios, series objetivo, rango de repeticiones y descanso.</p></div></div>
    <ul class="plan-list"><li>Biblioteca de ejercicios por grupo muscular</li><li>Orden de ejercicios, superseries y notas de técnica</li><li>Asignar rutinas a días de la semana y enlazarlas con Mi día</li><li>Duplicar, archivar y reutilizar rutinas</li></ul>
    <div class="empty">Todavía no se pueden crear rutinas: el almacenamiento llega en la Fase 2. No se guardará nada desde esta pantalla.</div></section>`;
}
function vEntrenar(){
  return `<section class="card timer-card"><h2>Temporizador de descanso <span class="chip chip-ok">Funciona ya</span></h2>
    <div class="timer"><div class="timer-ring" id="timerRing"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="52" stroke-width="8"/><circle class="ring-fg" id="timerArc" cx="60" cy="60" r="52" stroke-width="8" stroke-dasharray="326.73" stroke-dashoffset="0" transform="rotate(-90 60 60)"/></svg><b id="timerTxt" aria-live="polite">1:30</b></div>
      <div class="timer-controls"><div class="seg seg-wide" role="group" aria-label="Duración del descanso">${[60,90,120,180].map(s=>`<label><input type="radio" name="rest" value="${s}" ${s===gTimer.total?'checked':''}><span>${s<120?s+' s':(s/60)+' min'}</span></label>`).join('')}</div>
        <div class="timer-btns"><button class="b" type="button" data-timer="toggle" id="timerToggle">${gTimer.running?'Pausar':'Iniciar descanso'}</button><button class="g" type="button" data-timer="reset">Reiniciar</button><button class="g" type="button" data-timer="plus">+15 s</button></div>
        <p class="k">Al terminar suena un aviso${'vibrate' in navigator?' y vibra el teléfono':''}. No guarda datos.</p></div></div></section>
  <section class="card pending-card"><div class="pending-head">${gico('dumbbell',26)}<div><h2>Registro de series ${phase2()}</h2><p class="k">Elegirás una rutina, y por cada ejercicio registrarás series, repeticiones, peso y descanso, viendo lo que hiciste la última vez.</p></div></div>
    <div class="set-preview" aria-hidden="true"><div class="set-head"><span>Serie</span><span>Peso (kg)</span><span>Reps</span><span>Hecha</span></div>${[1,2,3].map(n=>`<div class="set-row"><span>${n}</span><span class="ghost"></span><span class="ghost"></span><span class="ghost sq"></span></div>`).join('')}</div>
    <p class="k">Vista previa del diseño, sin datos: los campos se habilitan en la Fase 2.</p></section>`;
}
function emptyChart(title,desc){return `<section class="card"><h2>${gesc(title)}</h2><div class="chart-empty" role="img" aria-label="${gesc(title)}: sin datos todavía"><div class="chart-grid">${'<i></i>'.repeat(4)}</div><span>Sin datos todavía</span></div><p class="k">${gesc(desc)}</p></section>`}
function vProgreso(){
  return `<p class="section-note">${phase2('Las gráficas se llenan con tus entrenamientos (Fase 2)')}</p><div class="report-grid">
    ${emptyChart('Volumen por semana','Suma de peso × repeticiones de cada semana.')}
    ${emptyChart('Récords personales','Mejor peso y repeticiones por ejercicio, con fecha.')}
    ${emptyChart('Frecuencia por grupo muscular','Cuántas series haces de pecho, espalda, pierna…')}
    ${emptyChart('Fuerza estimada (1RM)','Evolución estimada de tus levantamientos principales.')}</div>`;
}
function vFisico(){
  return `<section class="card pending-card"><div class="pending-head">${gico('body',26)}<div><h2>Peso y medidas ${phase2()}</h2><p class="k">Registrarás tu peso corporal y medidas para ver su evolución junto a tu entrenamiento.</p></div></div>
    <div class="metric-chips">${['Peso corporal','% de grasa','Cintura','Pecho','Brazo','Pierna','Cadera'].map(m=>`<span class="tag">${m}</span>`).join('')}</div>
    <div class="empty">Sin mediciones registradas. El registro se habilita en la Fase 2.</div></section>`;
}
function vNutricion(){
  return `<section class="card pending-card"><div class="pending-head">${gico('apple',26)}<div><h2>Alimentación ${phase2()}</h2><p class="k">Objetivos diarios de calorías, proteína, carbohidratos, grasas y agua, y un registro sencillo de comidas.</p></div></div>
    <div class="macro-preview">${['Calorías','Proteína','Carbohidratos','Grasas','Agua'].map(m=>`<div><span class="k">${m}</span><div class="bar"><i style="width:0"></i></div><small class="k">Sin objetivo</small></div>`).join('')}</div>
    <div class="empty">Sin objetivos ni comidas registradas. Se habilita en una fase posterior.</div></section>`;
}
function gRender(animate){
  const T=GYM_TABS.find(x=>x[0]===gtab),app=document.getElementById('gymApp');
  document.title=(gtab==='resumen'?'Gym':T[2]+' · Gym')+' · Mi Centro de Control';
  gNav();
  app.innerHTML=`<div class="ph"><h1 tabindex="-1">${gesc(T[2])}</h1>${gtab==='resumen'?'<p>Tu entrenamiento, conectado con Mi Centro de Control.</p>':''}</div>`+({resumen:vResumen,rutinas:vRutinas,entrenar:vEntrenar,progreso:vProgreso,fisico:vFisico,nutricion:vNutricion}[gtab])();
  if(gtab==='entrenar')gTimerPaint();
  if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){app.classList.remove('stagger');void app.offsetWidth;[...app.children].forEach((el,i)=>el.style.setProperty('--i',Math.min(i,8)));app.classList.add('stagger');setTimeout(()=>app.classList.remove('stagger'),1400)}
}

/* ---- Temporizador de descanso (no guarda datos) ---- */
const gTimer={total:90,left:90,running:false,endAt:0,iv:null};
function gTimerPaint(){
  const t=document.getElementById('timerTxt'),arc=document.getElementById('timerArc'),btn=document.getElementById('timerToggle');if(!t)return;
  const s=Math.max(0,Math.ceil(gTimer.left));t.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  arc.style.strokeDashoffset=(326.73*(1-gTimer.left/gTimer.total)).toFixed(2);
  btn.textContent=gTimer.running?'Pausar':gTimer.left<gTimer.total&&gTimer.left>0?'Continuar':'Iniciar descanso';
  document.getElementById('timerRing').classList.toggle('done',gTimer.left<=0);
}
function gTimerTick(){
  gTimer.left=(gTimer.endAt-Date.now())/1000;
  if(gTimer.left<=0){gTimer.left=0;gTimerStop();gToast('Descanso terminado: siguiente serie');sfx('success');try{navigator.vibrate?.([200,100,200])}catch(e){}}
  gTimerPaint();
}
function gTimerStart(){if(gTimer.left<=0)gTimer.left=gTimer.total;gTimer.running=true;gTimer.endAt=Date.now()+gTimer.left*1000;clearInterval(gTimer.iv);gTimer.iv=setInterval(gTimerTick,250);sfx('tap');gTimerPaint()}
function gTimerStop(){gTimer.running=false;clearInterval(gTimer.iv);gTimer.iv=null}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&gTimer.running)gTimerTick()});

let _gt;function gToast(m){const t=document.getElementById('toast');t.textContent=m;t.className='';void t.offsetWidth;t.className='show';clearTimeout(_gt);_gt=setTimeout(()=>t.className='',3200)}

/* ---- Eventos ---- */
document.addEventListener('click',e=>{
  const g=e.target.closest('[data-g]');if(g){document.querySelectorAll('dialog.sheet[open]').forEach(d=>d.close());sfx('tap');gGo(g.dataset.g);return}
  if(e.target.closest('[data-more]')){sfx('open');document.getElementById('moreSheet').showModal();return}
  if(e.target.closest('dialog.sheet [data-close]')){e.target.closest('dialog').close();return}
  if(e.target.matches('dialog.sheet[open]')){e.target.close();return}
  const tm=e.target.closest('[data-timer]');if(!tm)return;
  const a=tm.dataset.timer;
  if(a==='toggle'){if(gTimer.running){gTimerTick();gTimerStop();gTimerPaint()}else gTimerStart()}
  else if(a==='reset'){gTimerStop();gTimer.left=gTimer.total;gTimerPaint()}
  else if(a==='plus'){gTimer.left=Math.max(0,gTimer.left)+15;gTimer.total=Math.max(gTimer.total,gTimer.left);if(gTimer.running)gTimer.endAt=Date.now()+gTimer.left*1000;gTimerPaint()}
});
document.addEventListener('change',e=>{if(e.target.name==='rest'){gTimerStop();gTimer.total=gTimer.left=+e.target.value;gTimerPaint()}});

/* ---- Arranque ---- */
document.querySelectorAll('dialog.sheet [data-close]').forEach(b=>b.innerHTML=gico('x',16));
document.getElementById('gymDate').textContent=new Intl.DateTimeFormat('es-CO',{timeZone:GYM_TZ,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
gtab=GYM_TABS.some(x=>x[0]===location.hash.slice(1))?location.hash.slice(1):'resumen';
gData=gymReadLocalData(null);gSummary=gymSummary(gData);gRender(true);
gymSession().then(acc=>{
  gAccount=acc;const pill=document.getElementById('gymAccount'),label=pill.querySelector('span');
  const M={signed:['saved','Sesión iniciada'],local:['local','Solo en este dispositivo'],offline:['offline','Sin conexión'],error:['error','No se pudo comprobar la sesión']}[acc.state]||['local',''];
  pill.dataset.state=M[0];label.textContent=M[1];pill.title=acc.user?.email?'Sesión: '+acc.user.email:M[1];
  if(acc.user){const d=gymReadLocalData(acc.user.id);if(d&&d!==gData){gData=d;gSummary=gymSummary(gData);if(gtab==='resumen')gRender(false)}}
});
