/* ---- Gym Intelligence · recomendaciones (fase G): interfaz ----
   Tarjeta en Resumen: cada recomendación muestra observación, datos usados, conclusión, acción y confianza.
   «Ocultar» la esconde en este dispositivo hasta la semana siguiente. */
let gInsAll=false;
const GIN_TYPE={observation:['Observación','chip-muted'],estimation:['Estimación','chip-warn'],recommendation:['Recomendación','chip-ok']};
const ginHiddenKey=()=>GS.user?'mcc-gym-hidden-insights-'+GS.user.id:null;
function ginHidden(){try{return JSON.parse(localStorage.getItem(ginHiddenKey())||'{}')||{}}catch(_){return{}}}
const ginTag=k=>k+'@'+gymWeekStart(gymToday());

function vInsightsCard(){
  if(!signedIn()||!GS.ready)return '';
  let list;try{list=gymInsights(gymInsightsContext())}catch(e){return ''}
  const hidden=ginHidden(),visible=list.filter(x=>!hidden[ginTag(x.key)]),nHidden=list.length-visible.length;
  if(!visible.length)return nHidden?`<section class="card gin-card"><h2>Recomendaciones</h2><p class="k">Ocultaste ${nHidden} esta semana. <button class="lk" type="button" data-ins="unhide">Mostrar de nuevo</button></p></section>`:'';
  const shown=gInsAll?visible:visible.slice(0,3);
  const item=x=>{const [tl,tc]=GIN_TYPE[x.type]||['',''];return `<details class="gin-item is-${x.area}"><summary><span class="gin-sum"><b>${gesc(x.title)}</b><span class="gin-chips"><span class="chip ${tc}">${tl}</span><span class="chip chip-muted">Confianza ${gesc(x.confidence)}</span></span></span></summary>
    <dl class="gin-body"><dt>Observación</dt><dd>${gesc(x.observation)}</dd><dt>Datos usados</dt><dd><ul>${x.data.map(d=>`<li>${gesc(d)}</li>`).join('')}</ul></dd><dt>Conclusión</dt><dd>${gesc(x.conclusion)}</dd><dt>Qué hacer</dt><dd>${gesc(x.action.text||'')}</dd></dl>
    <div class="gin-actions"><button class="g" type="button" data-g="${gesc(x.action.tab)}">${gesc(x.action.label)}</button><button class="lk" type="button" data-ins="hide" data-key="${gesc(x.key)}">Ocultar esta semana</button></div></details>`};
  return `<section class="card gin-card"><div class="gn-meal-head"><h2>Recomendaciones</h2><span class="k">${visible.length}</span></div>${shown.map(item).join('')}
    ${visible.length>3?`<button class="lk" type="button" data-ins="toggle">${gInsAll?'Ver menos':`Ver todas (${visible.length})`}</button>`:''}
    <p class="k gin-foot">Calculadas con tus datos actuales; cada una muestra los datos que la respaldan. No son consejo médico.${nHidden?` ${nHidden} oculta${nHidden===1?'':'s'} esta semana · <button class="lk" type="button" data-ins="unhide">mostrar</button>`:''}</p></section>`;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-ins]');if(!b)return;const a=b.dataset.ins,k=ginHiddenKey();if(!k)return;
  if(a==='toggle'){gInsAll=!gInsAll;gRender(false);return}
  if(a==='hide'){const h=ginHidden();h[ginTag(b.dataset.key)]=1;
    // limpiar marcas de semanas anteriores
    const wk='@'+gymWeekStart(gymToday());Object.keys(h).forEach(x=>{if(!x.endsWith(wk))delete h[x]});
    try{localStorage.setItem(k,JSON.stringify(h))}catch(_){}sfx('tap');gRender(false);return}
  if(a==='unhide'){try{localStorage.removeItem(k)}catch(_){}gRender(false);return}
});
