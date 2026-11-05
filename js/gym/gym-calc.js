/* ---- Gym · cálculos (funciones puras, probadas en tests/gym-calc.test.mjs) ----
   Fechas en hora de Bogotá (UTC−5). Solo cuentan series registradas: nada se estima sin datos. */
const GYM_MUSCLES=['Pecho','Espalda','Hombros','Bíceps','Tríceps','Cuádriceps','Femoral','Glúteos','Pantorrillas','Abdomen','Antebrazo','Cardio','Otro'];
/* Fecha de Bogotá (AAAA-MM-DD) de un instante ISO o en ms. */
function gymDateOf(ts){const ms=typeof ts==='number'?ts:Date.parse(ts);const d=new Date(ms-5*3600000);return d.toISOString().slice(0,10)}
/* Lunes de la semana de una fecha. */
function gymWeekStart(date){const d=new Date(date+'T12:00:00Z'),dow=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-dow);return d.toISOString().slice(0,10)}
/* 1RM estimado (Epley). Con más de 12 repeticiones la estimación deja de ser fiable: devuelve null. */
function gymE1rm(weight,reps){weight=+weight||0;reps=+reps||0;if(weight<=0||reps<=0||reps>12)return null;if(reps===1)return weight;return Math.round(weight*(1+reps/30)*10)/10}
const gymSetVolume=s=>(+s.weight_kg||0)*(+s.reps||0);

/* Resumen de entrenamiento a partir de sesiones, series y ejercicios. */
function gymStats(sessions,sets,exercises,today,{weeks=8}={}){
  const exById=new Map((exercises||[]).map(e=>[e.id,e]));
  const sesById=new Map((sessions||[]).map(s=>[s.id,s]));
  const valid=(sets||[]).filter(s=>sesById.has(s.session_id));
  /* Fecha y semana de cada sesión, una sola vez (antes se recalculaban por cada serie). */
  const sDate=new Map(),sWeek=new Map();for(const x of sessions||[]){const d=gymDateOf(x.started_at);sDate.set(x.id,d);sWeek.set(x.id,gymWeekStart(d))}
  const thisWeek=gymWeekStart(today);
  /* Volumen por semana (las últimas `weeks`, terminando en la actual). */
  const weekKeys=Array.from({length:weeks},(_,i)=>{const d=new Date(thisWeek+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-7*(weeks-1-i));return d.toISOString().slice(0,10)});
  const volByWeek=new Map(weekKeys.map(k=>[k,0])),sesByWeek=new Map(weekKeys.map(k=>[k,new Set()]));
  for(const s of valid){const wk=sWeek.get(s.session_id);if(volByWeek.has(wk)){volByWeek.set(wk,volByWeek.get(wk)+gymSetVolume(s));sesByWeek.get(wk).add(s.session_id)}}
  for(const ses of sessions||[]){const wk=gymWeekStart(gymDateOf(ses.started_at));if(sesByWeek.has(wk))sesByWeek.get(wk).add(ses.id)}
  const weekly=weekKeys.map(k=>({week:k,volume:Math.round(volByWeek.get(k)),sessions:sesByWeek.get(k).size}));
  /* Récords por ejercicio: mayor peso (con sus reps) y mejor 1RM estimado, con fecha. */
  const prs=new Map();
  for(const s of valid){
    const ex=exById.get(s.exercise_id);if(!ex)continue;const date=sDate.get(s.session_id),w=+s.weight_kg||0,r=+s.reps||0,e=gymE1rm(w,r);
    const p=prs.get(ex.id)||{exercise_id:ex.id,name:ex.name,muscle:ex.muscle,bestWeight:0,bestWeightReps:0,bestWeightDate:null,bestE1rm:null,bestE1rmDate:null,sets:0};
    p.sets++;
    if(w>p.bestWeight||(w===p.bestWeight&&r>p.bestWeightReps)){p.bestWeight=w;p.bestWeightReps=r;p.bestWeightDate=date}
    if(e!==null&&(p.bestE1rm===null||e>p.bestE1rm)){p.bestE1rm=e;p.bestE1rmDate=date}
    prs.set(ex.id,p);
  }
  /* Series por grupo muscular en los últimos 30 días. */
  const from30=(()=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-29);return d.toISOString().slice(0,10)})();
  const muscles={};
  for(const s of valid){const date=sDate.get(s.session_id);if(date<from30||date>today)continue;const m=exById.get(s.exercise_id)?.muscle||'Otro';muscles[m]=(muscles[m]||0)+1}
  const cur=weekly[weekly.length-1]||{volume:0,sessions:0},prev=weekly[weekly.length-2]||{volume:0,sessions:0};
  const sorted=[...(sessions||[])].sort((a,b)=>String(b.started_at).localeCompare(String(a.started_at)));
  return{weekly,week:cur,prevWeek:prev,prs:[...prs.values()].sort((a,b)=>(b.bestE1rm||b.bestWeight)-(a.bestE1rm||a.bestWeight)),muscles:Object.entries(muscles).sort((a,b)=>b[1]-a[1]),lastSession:sorted[0]||null,totalSessions:(sessions||[]).length,hasData:valid.length>0};
}
/* Lo que hiciste la última vez en un ejercicio (para mostrarlo al entrenar). */
function gymLastPerformance(exerciseId,sessions,sets,excludeSessionId=null){
  const sesById=new Map((sessions||[]).map(s=>[s.id,s]));
  const mine=(sets||[]).filter(s=>s.exercise_id===exerciseId&&s.session_id!==excludeSessionId&&sesById.has(s.session_id));
  if(!mine.length)return null;
  const last=mine.reduce((a,s)=>String(sesById.get(s.session_id).started_at)>String(sesById.get(a.session_id).started_at)?s:a);
  const sid=last.session_id;
  return{date:gymDateOf(sesById.get(sid).started_at),sets:mine.filter(s=>s.session_id===sid).sort((a,b)=>a.set_index-b.set_index).map(s=>({weight_kg:+s.weight_kg,reps:+s.reps}))};
}
/* Variación de peso corporal: primera y última medición dentro de los últimos N días. */
function gymWeightTrend(metrics,today,days=30){
  const from=(()=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(days-1));return d.toISOString().slice(0,10)})();
  const w=(metrics||[]).filter(m=>m.weight_kg!==null&&m.weight_kg!==undefined&&m.date>=from&&m.date<=today).sort((a,b)=>a.date.localeCompare(b.date));
  if(w.length<2)return{points:w.length,latest:w[w.length-1]||null,change:null};
  return{points:w.length,latest:w[w.length-1],change:Math.round((+w[w.length-1].weight_kg-(+w[0].weight_kg))*10)/10};
}
if(typeof module!=='undefined')module.exports={gymDateOf,gymWeekStart,gymE1rm,gymStats,gymLastPerformance,gymWeightTrend,GYM_MUSCLES};
