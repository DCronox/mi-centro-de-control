/* ---- Gym Intelligence · progresión de cargas (fase E): interfaz ----
   Muestra la propuesta del motor (gym-progression.js) en cada ejercicio del entrenamiento y en Progreso.
   Nada cambia sin que la persona pulse «Usar». Utilidades de gym.js solo dentro de funciones. */
const GPG_ICON={increase:'up',maintain:'check',retry:'timer',reduce:'down',reps:'plus',start:'info'};
const GPG_CONF={alta:'chip-ok',media:'chip-warn',baja:'chip-muted'};

function vSuggestBox(p,{ei=null,compact=false}={}){
  const canApply=ei!==null&&p.weight!==null&&p.weight!==undefined&&p.action!=='start'&&p.action!=='reps';
  const why=[...p.reasons,...p.notes].map(r=>`<li>${gesc(r)}</li>`).join('');
  return `<div class="pg-box is-${p.action}"><div class="pg-head">${gico(GPG_ICON[p.action]||'info',16)}<b>${gesc(p.title)}</b><span class="chip ${GPG_CONF[p.confidence]||''}">Confianza ${gesc(p.confidence)}</span></div>
    ${compact?'':`<ul class="pg-why">${why}</ul>${p.data.length?`<p class="k pg-data">Datos usados: ${p.data.map(gesc).join(' · ')}</p>`:''}`}
    ${canApply?`<button class="g pg-apply" type="button" data-pg="apply" data-ei="${ei}" data-w="${p.weight}">${gico('check',14)}<span>Usar ${gesc(String(p.weight).replace('.',','))} kg en las series pendientes</span></button>`:''}</div>`;
}
/* Propuesta para un ejercicio del entrenamiento en curso. */
function vWorkoutSuggestion(ex,ei,w){
  const t=ex.target||{};
  return vSuggestBox(gymSuggestFor(ex.exercise_id,t,w.id),{ei});
}
/* Tarjeta «Próxima sesión» en Progreso: usa el objetivo de la rutina más reciente que tenga el ejercicio. */
function vNextSessionCard(exerciseId){
  if(!exerciseId)return '';
  const item=GS.routines.flatMap(r=>(r.items||[]).map(it=>({it,u:r.updated_at||''}))).filter(x=>x.it.exercise_id===exerciseId).sort((a,b)=>String(b.u).localeCompare(String(a.u)))[0]?.it;
  const p=gymSuggestFor(exerciseId,item||{});
  return `<section class="card"><h2>Próxima sesión · ${gesc(exName(exerciseId))}</h2>${vSuggestBox(p)}
    <p class="k">${item?`Según tu rutina: ${item.sets} × ${item.reps_min}–${item.reps_max}, RIR ${item.rir_target??GYM_PROG_RIR}, incremento ${String(item.increment_kg??gymDefaultIncrement(exName(exerciseId))).replace('.',',')} kg.`:`Sin rutina con este ejercicio: se usa 3 × 8–12 y RIR ${GYM_PROG_RIR}.`} Doble progresión: primero repeticiones, luego peso. Solo es una propuesta.</p></section>`;
}

document.addEventListener('click',e=>{
  const b=e.target.closest('[data-pg="apply"]');if(!b)return;
  const w=gymActive();if(!w)return;const ex=w.exercises[+b.dataset.ei];if(!ex)return;
  const kgv=+b.dataset.w;let n=0;
  ex.sets.forEach(s=>{if(!s.done){s.weight_kg=kgv;n++}});
  gymSetActive(w);sfx('check');gToast(n?`${n} ${n===1?'serie':'series'} con ${String(kgv).replace('.',',')} kg`:'No quedan series pendientes');gRender(false);
});
