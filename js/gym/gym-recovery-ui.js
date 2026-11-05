/* ---- Gym Intelligence · recuperación (fase F): interfaz ----
   Registro del día (sueño y sensaciones), cómo llegas hoy, tendencia con datos mínimos y lectura por músculo.
   Utilidades de gym.js solo dentro de funciones. */
let gRecDate=null;
const GRC_SCALES=[
  ['sleep_quality','Calidad del sueño','Muy mala','Excelente'],['energy','Energía','Muy baja','Muy alta'],
  ['fatigue','Fatiga','Ninguna','Mucha'],['soreness','Dolor muscular','Ninguno','Mucho'],['stress','Estrés','Ninguno','Mucho']];
const GRC_LEVEL={ok:['chip-ok','Sin alertas'],caution:['chip-warn','Con precaución'],low:['chip-bad','Prioriza recuperarte'],unknown:['chip-muted','Sin registro de hoy']};
const grcN=x=>String(x).replace('.',',');

function vReadinessCard(){
  const l=gymRecoveryFor(gymToday()),r=gymReadiness(l),[cls,lab]=GRC_LEVEL[r.level];
  return `<section class="card rc-ready is-${r.level}"><div class="rc-ready-head"><h2>Cómo llegas hoy</h2><span class="chip ${cls}">${lab}</span></div>
    ${r.reasons.length?`<ul class="pg-why">${r.reasons.map(x=>`<li>${gesc(x)}</li>`).join('')}</ul>`:''}<p class="k">${gesc(r.advice)}</p>
    ${r.level==='caution'||r.level==='low'?'<p class="k">Mientras tanto, las propuestas de carga de hoy no sugieren subir peso.</p>':''}</section>`;
}
function vRecoveryForm(){
  const date=gRecDate||gymToday(),l=gymRecoveryFor(date)||{},sore=new Set(l.sore_muscles||[]);
  const scale=([k,n,lo,hi])=>`<fieldset class="rc-scale"><legend>${n}</legend><div class="seg rc-seg">${[1,2,3,4,5].map(v=>`<label><input type="radio" name="${k}" value="${v}" ${+l[k]===v?'checked':''}><span>${v}</span></label>`).join('')}</div><div class="rc-ends"><span>${lo}</span><span>${hi}</span></div></fieldset>`;
  const groups={};GYM_MUSCLE_LIST.forEach(([id,name,group])=>{(groups[group]=groups[group]||[]).push([id,name])});
  const muscles=Object.entries(groups).map(([g,ms])=>`<div class="rc-mgroup"><span class="k">${g}</span>${ms.map(([id,n])=>`<label class="rc-chip"><input type="checkbox" name="sore_muscles" value="${id}" ${sore.has(id)?'checked':''}><span>${gesc(n)}</span></label>`).join('')}</div>`).join('');
  const calc=gymSleepHours(l.bed_time?.slice(0,5),l.wake_time?.slice(0,5));
  return `<section class="card"><h2>${l.id?'Tu registro':'Registrar el día'}</h2><form id="fRecovery" class="rc-form">
    <div class="gp-grid"><label class="fl">Fecha<input type="date" name="date" value="${date}" max="${gymToday()}" required></label>
      <label class="fl">Me acosté<input type="time" name="bed_time" value="${gesc(l.bed_time?.slice(0,5)||'')}"></label>
      <label class="fl">Me levanté<input type="time" name="wake_time" value="${gesc(l.wake_time?.slice(0,5)||'')}"></label>
      <label class="fl">Horas dormidas<input type="number" name="sleep_h" min="0" max="16" step="0.1" inputmode="decimal" value="${gesc(l.sleep_h??'')}" placeholder="${calc!==null?grcN(calc)+' (calculado)':'Opcional'}"></label></div>
    <p class="k">Si escribes las horas de acostarte y levantarte, se calculan solas. Todo es opcional: registra solo lo que quieras.</p>
    <div class="rc-scales">${GRC_SCALES.map(scale).join('')}</div>
    <details class="rc-sore" ${sore.size?'open':''}><summary>¿Molestias en algún músculo? ${sore.size?`(${sore.size})`:''}</summary>${muscles}</details>
    <label class="fl">Notas<input name="notes" maxlength="300" value="${gesc(l.notes||'')}" placeholder="Opcional"></label>
    <div class="gp-res-actions"><button class="b" type="submit">${gico('check',15)}<span>Guardar</span></button>${l.id?`<button class="g danger" type="button" data-ract="del" data-id="${gesc(l.id)}">Borrar este día</button>`:''}</div>
  </form></section>`;
}
function vRecoveryTrend(){
  const t=gymRecoveryTrend(GS.recovery,gymToday());
  const rows=GYM_REC_METRICS.map(([k,n,u,higherBetter])=>{const m=t[k];
    if(!m.n&&!m.nPrev)return '';
    const val=x=>x===null?'—':grcN(x)+(u==='h'?' h':'/5');
    const d=m.enough&&m.delta!==0?`<span class="${(m.delta>0)===higherBetter?'rc-up':'rc-down'}">${m.delta>0?'+':''}${grcN(m.delta)}</span>`:m.enough?'<span class="k">igual</span>':`<span class="k">sin base (${m.n} y ${m.nPrev} registros)</span>`;
    return `<div class="row"><div class="g1"><b>${n}</b><small>Últimos 7 días: ${val(m.cur)} · 7 anteriores: ${val(m.prev)}</small></div>${d}</div>`}).join('');
  return `<section class="card"><h2>Tendencia</h2>${rows||'<div class="empty">Registra varios días para ver tu tendencia.</div>'}<p class="k">Solo se compara con al menos 3 registros en cada semana. Referencia general de sueño para adultos: 7 h o más (AASM/SRS, 2015).</p></section>`;
}
function vMuscleRecovery(){
  const today=gymToday(),st7=gymMuscleStats(GS.sessions,GS.sets,GS.exercises,gymDaysAgo(today,6),today),st30=gymMuscleStats(GS.sessions,GS.sets,GS.exercises,gymDaysAgo(today,29),today);
  const rows=gymMuscleRecovery(st7,st30,gymRecoveryFor(today)?.sore_muscles||[],today);
  return `<section class="card"><h2>Por músculo</h2>${rows.length?rows.map(r=>`<div class="row rc-m is-${r.flag}"><div class="g1"><b>${gesc(r.name)}</b><small>${gesc(r.note)}</small></div><span class="tag">${grcN(r.weightedSets7)} series · 7 días</span></div>`).join(''):'<div class="empty">Aún no hay entrenamientos en los últimos 30 días.</div>'}
    <p class="k">El tiempo desde el último estímulo es un dato, no un diagnóstico: la app no afirma que un músculo esté recuperado. Series ponderadas: 1 si el músculo es principal, 0,5 si es secundario.</p></section>`;
}
function vRecoveryHistory(){
  const list=GS.recovery.slice(0,14);
  return `<section class="card"><h2>Últimos registros</h2>${list.length?list.map(l=>{const sh=gymLogSleep(l),parts=[sh!==null?grcN(sh)+' h de sueño':null,...GRC_SCALES.filter(([k])=>l[k]).map(([k,n])=>n.toLowerCase()+' '+l[k])].filter(Boolean);
    return `<div class="row"><div class="g1"><b>${gesc(fdate(l.date))}</b><small>${gesc(parts.join(' · ')||'Sin valores')}${l.sore_muscles?.length?' · molestias: '+gesc(l.sore_muscles.map(m=>GYM_MUSCLES_BY_ID[m]?.name||m).join(', ')):''}</small></div><button class="g ic-b" type="button" data-ract="edit" data-date="${gesc(l.date)}" aria-label="Editar ${gesc(l.date)}">${gico('edit',15)}</button></div>`}).join(''):'<div class="empty">Aún no hay registros.</div>'}</section>`;
}
function vRecuperacion(){
  const gate=needAccount('tu recuperación');if(gate)return gate;
  if(GS.recoverySchema===false)return `<p class="sync-banner">${gico('cloud',16)}<span>El registro de recuperación aún no se puede guardar: falta aplicar la actualización de la base de datos de Gym.</span></p>`+vMuscleRecovery();
  return vReadinessCard()+vRecoveryForm()+`<div class="cols">${vMuscleRecovery()}${vRecoveryTrend()}</div>`+vRecoveryHistory();
}

document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-ract]');if(!b)return;const a=b.dataset.ract;
  if(a==='edit'){gRecDate=b.dataset.date===gymToday()?null:b.dataset.date;gRender(false);scrollTo(0,0);return}
  if(a==='del'){const l=GS.recovery.find(x=>x.id===b.dataset.id);if(!l)return;
    if(!await ask(`Se borrará el registro del ${fdate(l.date)}.`,{title:'¿Borrar registro?',confirmLabel:'Borrar',danger:true}))return;
    const ok=await gTry(()=>gymDeleteRecovery(l.id).then(()=>true),'Registro borrado');if(ok){sfx('delete');gRecDate=null}gRender(false);return}
});
document.addEventListener('change',e=>{if(e.target.form?.id==='fRecovery'&&e.target.name==='date'){const d=e.target.value;if(d&&d<=gymToday()){gRecDate=d===gymToday()?null:d;gRender(false)}}});
document.addEventListener('submit',async e=>{
  const f=e.target;if(f.id!=='fRecovery')return;e.preventDefault();
  const fd=new FormData(f),v=Object.fromEntries(fd);v.sore_muscles=fd.getAll('sore_muscles');
  const btn=f.querySelector('[type=submit]');btn.disabled=true;const r=await gTry(()=>gymSaveRecovery(v),'Registro guardado');btn.disabled=false;
  if(r){sfx('success');gRecDate=null;gRender(false);scrollTo(0,0)}
});
