/* ---- Gym Intelligence · motor de progresión de cargas (fase E): funciones puras ----
   Doble progresión: primero se suben repeticiones dentro del rango; cuando todas las series llegan al
   máximo del rango con el esfuerzo objetivo, se propone subir el peso. Solo PROPONE: la persona decide.
   Esfuerzo: RIR = 10 − RPE (escala de Zourdos et al. 2016). Incremento recomendado por ACSM 2009: 2–10 %
   cuando se superan en 1–2 repeticiones las objetivo. La regla de «dos sesiones fallidas → bajar» es un
   criterio prudente propio de la app, no una cita. */

const GYM_PROG_RIR=2;          // RIR objetivo por defecto
const GYM_PROG_STALE_DAYS=21;  // sin hacer el ejercicio en 3 semanas → prudencia

/* Incremento por defecto según el tipo de ejercicio (editable en la rutina). */
function gymDefaultIncrement(name){
  const n=String(name||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if(/dominada|fondos|flexion|plancha|abdominal|crunch|burpee|peso corporal/.test(n))return 0;
  if(/mancuerna/.test(n))return 2;
  if(/maquina|polea|prensa|extension de pierna|extension de cuadriceps|curl femoral|jalon|pec deck|smith/.test(n))return 5;
  return 2.5; // barra y resto
}

const gpR05=x=>Math.round(x*2)/2;
const gpN=x=>String(x).replace(".",","); // decimales en español
const gpE1=(w,r)=>w>0&&r>0&&r<=12?w*(1+r/30):null; // Epley, solo hasta 12 repeticiones

/* Historial de un ejercicio por sesión (más reciente primero). */
function gymExerciseHistory(exerciseId,sessions,sets,{limit=4,excludeSession=null}={}){
  const byId=new Map((sessions||[]).map(s=>[s.id,s])),groups=new Map();
  for(const x of sets||[]){
    if(x.exercise_id!==exerciseId||x.session_id===excludeSession||!byId.has(x.session_id))continue;
    if(!groups.has(x.session_id))groups.set(x.session_id,[]);
    groups.get(x.session_id).push({weight:+x.weight_kg||0,reps:+x.reps||0,rpe:x.rpe===null||x.rpe===undefined||x.rpe===''?null:+x.rpe,set_index:+x.set_index||0});
  }
  return [...groups.entries()].map(([id,ss])=>({session_id:id,started_at:byId.get(id).started_at,sets:ss.sort((a,b)=>a.set_index-b.set_index)}))
    .sort((a,b)=>String(b.started_at).localeCompare(String(a.started_at))).slice(0,limit);
}
/* Series de trabajo: las hechas con el peso más alto de la sesión (las de aproximación no cuentan). */
function gymWorkingSets(session){
  const top=Math.max(0,...session.sets.map(s=>s.weight));
  return{weight:top,sets:session.sets.filter(s=>s.weight===top)};
}
const gpBestE1=s=>Math.max(0,...s.sets.map(x=>gpE1(x.weight,x.reps)||0));

/* Propuesta para la próxima sesión del ejercicio.
   target: {sets, reps_min, reps_max, rir_target, increment_kg}; history: gymExerciseHistory(); today: 'AAAA-MM-DD'. */
function gymProgression(target,history,{today=null,name='',readiness=null}={}){
  const t={sets:+target?.sets||3,reps_min:+target?.reps_min||8,reps_max:Math.max(+target?.reps_min||8,+target?.reps_max||12),
    rir:target?.rir_target===undefined||target?.rir_target===null||target?.rir_target===''?GYM_PROG_RIR:+target.rir_target,
    inc:target?.increment_kg===undefined||target?.increment_kg===null||target?.increment_kg===''?gymDefaultIncrement(name):+target.increment_kg};
  const out={action:'start',weight:null,reps_min:t.reps_min,reps_max:t.reps_max,confidence:'baja',title:'',reasons:[],notes:[],data:[],increment:t.inc,rir_target:t.rir};
  if(!history||!history.length){
    out.title=`Elige un peso con el que hagas ${t.reps_min}–${t.reps_max} repeticiones dejando unas ${t.rir} en reserva.`;
    out.reasons.push('Aún no hay registros de este ejercicio.');return out;
  }
  const last=history[0],ws=gymWorkingSets(last),W=ws.weight,reps=ws.sets.map(s=>s.reps);
  const fmt=s=>s.sets.map(x=>`${gpN(x.weight)}×${x.reps}${x.rpe!==null?' @'+gpN(x.rpe):''}`).join(', ');
  out.data.push(`Última sesión: ${fmt(last)}`);
  if(history[1])out.data.push(`Anterior: ${fmt(history[1])}`);
  const rirs=ws.sets.filter(s=>s.rpe!==null).map(s=>10-s.rpe);
  const effortOk=rirs.length?Math.min(...rirs)>=t.rir-1:null; // margen de 1 repetición
  const allTop=ws.sets.length>=t.sets&&reps.every(r=>r>=t.reps_max);
  const failed=reps.some(r=>r<t.reps_min);
  const days=today?Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(String(last.started_at).slice(0,10)+'T12:00:00Z'))/864e5):0;
  const prev=history[1],prevWs=prev?gymWorkingSets(prev):null,sameW=prevWs&&prevWs.weight===W;
  out.weight=W;

  if(allTop&&effortOk!==false){
    if(!(W>0)||!(t.inc>0)){
      out.action='reps';out.confidence=effortOk?'alta':'media';
      out.title=W>0?`Llegaste al máximo del rango: añade repeticiones o una serie (incremento de peso en 0).`:`Llegaste al máximo del rango con tu peso corporal: añade repeticiones, una serie o lastre.`;
      out.reasons.push(`Todas las series llegaron a ${t.reps_max} repeticiones.`);
    }else{
      out.action='increase';out.weight=gpR05(W+t.inc);out.confidence=effortOk?'alta':'media';
      out.title=`Sube a ${gpN(out.weight)} kg y apunta a ${t.reps_min}–${t.reps_max} repeticiones.`;
      out.reasons.push(`Todas las series de trabajo llegaron a ${t.reps_max} repeticiones${effortOk?` con RIR ${gpN(Math.min(...rirs))} o más`:''}.`);
      const pct=t.inc/W*100;
      if(pct>10)out.notes.push(`El salto es del ${Math.round(pct)} % (ACSM sugiere 2–10 %). Si no llegas a ${t.reps_min} repeticiones, usa un incremento menor.`);
      if(effortOk===null)out.notes.push('Registra el RPE de tus series para afinar la propuesta.');
    }
  }else if(allTop&&effortOk===false){
    out.action='maintain';out.confidence='media';
    out.title=`Mantén ${gpN(W)} kg una sesión más.`;
    out.reasons.push(`Llegaste a ${t.reps_max} repeticiones, pero con menos reserva de la prevista (RIR ${gpN(Math.min(...rirs))} frente a ${t.rir}).`);
  }else if(failed){
    const prevFailed=sameW&&prevWs.sets.some(s=>s.reps<t.reps_min);
    if(prevFailed){
      const step=t.inc>0?t.inc:0.5,down=Math.max(0,Math.floor(W*0.9/step)*step);
      out.action='reduce';out.weight=gpR05(down<W?down:Math.max(0,W-step));out.confidence='media';
      out.title=`Baja a ${gpN(out.weight)} kg (≈10 % menos) o descansa más entre series.`;
      out.reasons.push(`En las dos últimas sesiones con ${gpN(W)} kg alguna serie quedó por debajo de ${t.reps_min} repeticiones.`);
      out.notes.push('Antes de bajar, revisa descanso, sueño y fatiga: con 2–3 min de descanso en ejercicios compuestos suele mejorar el rendimiento.');
    }else{
      out.action='retry';out.confidence='media';
      out.title=`Repite ${gpN(W)} kg e intenta llegar a ${t.reps_min} repeticiones en todas las series.`;
      out.reasons.push(`En la última sesión alguna serie quedó por debajo de ${t.reps_min} repeticiones.`);
      out.notes.push('Si vuelve a pasar en la próxima sesión, se propondrá bajar el peso.');
    }
  }else{
    out.action='maintain';out.confidence='alta';
    out.title=`Mantén ${gpN(W)} kg y suma repeticiones hasta llegar a ${t.reps_max} en todas las series.`;
    if(ws.sets.length<t.sets){out.reasons.push(`Hiciste ${ws.sets.length} de ${t.sets} series de trabajo: complétalas antes de subir.`);}
    else out.reasons.push(`Estás dentro del rango (${Math.min(...reps)===Math.max(...reps)?Math.min(...reps):Math.min(...reps)+'–'+Math.max(...reps)} repeticiones).`);
    if(sameW){const a=reps.reduce((x,y)=>x+y,0),b=prevWs.sets.map(s=>s.reps).reduce((x,y)=>x+y,0);if(a>b)out.reasons.push(`Vas mejorando: +${a-b} repeticiones frente a la sesión anterior con el mismo peso.`)}
  }

  // Rendimiento claramente por debajo de las sesiones anteriores (1RM estimado).
  const prevE=history.slice(1,3).map(gpBestE1).filter(x=>x>0),lastE=gpBestE1(last);
  if(prevE.length&&lastE>0){const avg=prevE.reduce((a,b)=>a+b,0)/prevE.length;if(lastE<avg*0.95){out.notes.push(`Tu última sesión rindió un ${Math.round((1-lastE/avg)*100)} % por debajo de las anteriores (1RM estimado): revisa descanso, sueño y fatiga.`);if(out.action==='increase'){out.action='maintain';out.weight=W;out.title=`Mantén ${gpN(W)} kg una sesión más.`;out.confidence='media'}}}
  // Recuperación declarada hoy (fase F): con señales de alerta no se propone subir.
  if(readiness&&(readiness.level==='caution'||readiness.level==='low')){
    out.notes.push(`Hoy registraste: ${readiness.reasons.join(' ').toLowerCase()}`.trim());
    if(out.action==='increase'){out.action='maintain';out.weight=W;out.title=`Hoy mantén ${gpN(W)} kg; sube cuando te sientas mejor.`;out.confidence='media'}
  }
  // Mucho tiempo sin hacerlo: prudencia.
  if(days>=GYM_PROG_STALE_DAYS){out.notes.push(`Hace ${days} días que no haces este ejercicio: empieza conservador.`);if(out.action==='increase'){out.action='maintain';out.weight=W;out.title=`Retoma con ${gpN(W)} kg (o algo menos) y comprueba cómo te sientes.`}out.confidence='baja'}
  return out;
}

if(typeof module!=='undefined')module.exports={GYM_PROG_RIR,gymDefaultIncrement,gymExerciseHistory,gymWorkingSets,gymProgression};
