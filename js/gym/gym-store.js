/* ---- Gym · almacenamiento (Fase 2) ----
   Supabase (tablas gym_* y body_metrics, con RLS) usando el cliente de gym-data.js.
   - El entrenamiento en curso vive en el navegador (sobrevive a recargas y a quedarse sin señal).
   - Al terminarlo pasa a una cola local y se sube; si falla, se reintenta al volver la conexión.
   - Los ids de entrenamientos y series se generan aquí, así que reintentar nunca duplica. */
const gymUid=()=>globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g,()=>(Math.random()*16|0).toString(16));
const GS={user:null,ready:false,error:'',exercises:[],routines:[],sessions:[],sets:[],metrics:[],syncing:false};
const gKey=k=>'mcc-gym-'+k+'-'+(GS.user?.id||'anon');
const gRead=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(gKey(k)));return v??d}catch(e){return d}};
const gWrite=(k,v)=>{try{if(v===null)localStorage.removeItem(gKey(k));else localStorage.setItem(gKey(k),JSON.stringify(v));return true}catch(e){return false}};
function gymErr(e){const m=String(e?.message||e||'');if(/Failed to fetch|NetworkError|network/i.test(m))return 'Sin conexión. Inténtalo de nuevo cuando tengas internet.';if(/schema cache|does not exist/i.test(m))return 'Las tablas de Gym aún no existen en Supabase.';return m||'Error desconocido'}
async function gq(p){const r=await p;if(r.error)throw r.error;return r.data}

/* Carga todo lo necesario (últimos 365 días de entrenamientos). */
async function gymLoadAll(){
  if(!gymClient||!GS.user)return false;
  const since=new Date(Date.now()-365*864e5).toISOString();
  try{
    const [ex,ro,ses,met]=await Promise.all([
      gq(gymClient.from('gym_exercises').select('id,name,muscle,notes,archived').order('name')),
      gq(gymClient.from('gym_routines').select('id,name,days,items,position,archived,updated_at').eq('archived',false).order('position').order('created_at')),
      gq(gymClient.from('gym_sessions').select('id,routine_id,name,started_at,ended_at,notes').gte('started_at',since).order('started_at',{ascending:false})),
      gq(gymClient.from('body_metrics').select('id,date,weight_kg,body_fat,waist_cm,chest_cm,arm_cm,thigh_cm,hip_cm,notes').order('date',{ascending:false}).limit(400))
    ]);
    let sets=[];
    const ids=ses.map(s=>s.id);
    for(let i=0;i<ids.length;i+=150){sets=sets.concat(await gq(gymClient.from('gym_sets').select('id,session_id,exercise_id,set_index,weight_kg,reps,rpe').in('session_id',ids.slice(i,i+150))))}
    Object.assign(GS,{exercises:ex,routines:ro,sessions:ses,sets,metrics:met,ready:true,error:''});
    return true;
  }catch(e){GS.error=gymErr(e);GS.ready=false;return false}
}
const gymExercise=id=>GS.exercises.find(e=>e.id===id)||null;

/* Ejercicios: crea uno (o reutiliza el que ya tenga ese nombre). */
async function gymEnsureExercise(name,muscle){
  name=String(name||'').trim().slice(0,80);if(!name)throw new Error('Escribe el nombre del ejercicio.');
  const found=GS.exercises.find(e=>e.name.trim().toLocaleLowerCase('es-CO')===name.toLocaleLowerCase('es-CO'));
  if(found){if(found.archived){await gq(gymClient.from('gym_exercises').update({archived:false}).eq('id',found.id));found.archived=false}return found}
  const row=await gq(gymClient.from('gym_exercises').insert({name,muscle:GYM_MUSCLES.includes(muscle)?muscle:'Otro'}).select('id,name,muscle,notes,archived').single());
  GS.exercises.push(row);GS.exercises.sort((a,b)=>a.name.localeCompare(b.name,'es-CO'));return row;
}
async function gymUpdateExercise(id,patch){const row=await gq(gymClient.from('gym_exercises').update(patch).eq('id',id).select('id,name,muscle,notes,archived').single());Object.assign(gymExercise(id),row);return row}

/* Rutinas. items: [{exercise_id,sets,reps_min,reps_max,rest_s,notes}] */
function gymCleanItems(items){return(items||[]).filter(i=>i&&i.exercise_id).slice(0,40).map(i=>({exercise_id:i.exercise_id,sets:Math.min(20,Math.max(1,Math.round(+i.sets||3))),reps_min:Math.min(100,Math.max(1,Math.round(+i.reps_min||8))),reps_max:Math.min(100,Math.max(1,Math.round(+i.reps_max||+i.reps_min||12))),rest_s:Math.min(900,Math.max(0,Math.round(+i.rest_s||90))),notes:String(i.notes||'').slice(0,120)}))}
async function gymSaveRoutine(r){
  const body={name:String(r.name||'').trim().slice(0,60)||'Rutina',days:[...new Set((r.days||[]).map(Number).filter(d=>d>=0&&d<=6))].sort(),items:gymCleanItems(r.items),position:Number.isFinite(+r.position)?+r.position:GS.routines.length};
  if(r.id){const row=await gq(gymClient.from('gym_routines').update(body).eq('id',r.id).select('id,name,days,items,position,archived,updated_at').single());GS.routines=GS.routines.map(x=>x.id===row.id?row:x);return row}
  const row=await gq(gymClient.from('gym_routines').insert(body).select('id,name,days,items,position,archived,updated_at').single());GS.routines.push(row);return row;
}
/* Se archiva en vez de borrar: los entrenamientos pasados conservan su referencia. */
async function gymArchiveRoutine(id){await gq(gymClient.from('gym_routines').update({archived:true}).eq('id',id));GS.routines=GS.routines.filter(r=>r.id!==id)}

/* ---- Entrenamiento en curso (local) ---- */
const gymActive=()=>gRead('active',null);
function gymSetActive(w){gWrite('active',w)}
function gymStartWorkout(routine){
  const items=routine?gymCleanItems(routine.items):[];
  const w={id:gymUid(),routine_id:routine?.id||null,name:routine?.name||'Entrenamiento libre',started_at:new Date().toISOString(),
    exercises:items.map(it=>{const last=gymLastPerformance(it.exercise_id,GS.sessions,GS.sets);return{exercise_id:it.exercise_id,target:it,sets:Array.from({length:it.sets},(_,i)=>({id:gymUid(),weight_kg:last?.sets[i]?.weight_kg??last?.sets.at(-1)?.weight_kg??'',reps:'',done:false}))}})};
  gymSetActive(w);return w;
}
function gymAddExerciseToActive(exerciseId){const w=gymActive();if(!w)return;const last=gymLastPerformance(exerciseId,GS.sessions,GS.sets);w.exercises.push({exercise_id:exerciseId,target:{sets:3,reps_min:8,reps_max:12,rest_s:90},sets:Array.from({length:3},(_,i)=>({id:gymUid(),weight_kg:last?.sets[i]?.weight_kg??'',reps:'',done:false}))});gymSetActive(w)}

/* Termina: pasa a la cola y la sube. Devuelve {saved, queued, sets}. */
async function gymFinishWorkout(){
  const w=gymActive();if(!w)return{saved:false,queued:false,sets:0};
  const sets=[];w.exercises.forEach(ex=>{let n=0;ex.sets.forEach(s=>{if(!s.done)return;const reps=Math.round(+s.reps),kg=Math.round((+s.weight_kg||0)*100)/100;if(!(reps>=0&&reps<=500)||!(kg>=0&&kg<=1000))return;sets.push({id:s.id,session_id:w.id,exercise_id:ex.exercise_id,set_index:++n,weight_kg:kg,reps})})});
  const payload={session:{id:w.id,routine_id:w.routine_id,name:String(w.name||'').slice(0,60),started_at:w.started_at,ended_at:new Date().toISOString(),notes:String(w.notes||'').slice(0,500)},sets};
  const q=gRead('queue',[]);q.push(payload);gWrite('queue',q);gymSetActive(null);
  const ok=await gymFlushQueue();
  return{saved:ok&&!gRead('queue',[]).some(p=>p.session.id===w.id),queued:true,sets:sets.length};
}
function gymDiscardWorkout(){gymSetActive(null)}
/* Sube lo pendiente. upsert por id: si un intento anterior quedó a medias, no se duplica nada. */
async function gymFlushQueue(){
  if(!gymClient||!GS.user||GS.syncing)return false;
  let q=gRead('queue',[]);if(!q.length)return true;
  GS.syncing=true;
  try{
    while(q.length){
      const p=q[0];
      await gq(gymClient.from('gym_sessions').upsert(p.session,{onConflict:'id'}));
      if(p.sets.length)await gq(gymClient.from('gym_sets').upsert(p.sets,{onConflict:'id'}));
      GS.sessions=[p.session,...GS.sessions.filter(s=>s.id!==p.session.id)];GS.sets=GS.sets.filter(s=>s.session_id!==p.session.id).concat(p.sets);
      q.shift();gWrite('queue',q);
    }
    return true;
  }catch(e){GS.error=gymErr(e);return false}finally{GS.syncing=false}
}
const gymPendingCount=()=>gRead('queue',[]).length;
async function gymDeleteSession(id){await gq(gymClient.from('gym_sessions').delete().eq('id',id));GS.sessions=GS.sessions.filter(s=>s.id!==id);GS.sets=GS.sets.filter(s=>s.session_id!==id)}

/* ---- Medidas corporales ---- */
async function gymSaveMetric(m){
  const n=(v,a,b)=>{if(v===''||v===null||v===undefined)return null;const x=Math.round(+v*10)/10;return Number.isFinite(x)&&x>=a&&x<=b?x:undefined};
  const row={date:m.date,weight_kg:n(m.weight_kg,20,400),body_fat:n(m.body_fat,2,70),waist_cm:n(m.waist_cm,30,250),chest_cm:n(m.chest_cm,30,250),arm_cm:n(m.arm_cm,10,100),thigh_cm:n(m.thigh_cm,20,150),hip_cm:n(m.hip_cm,30,250),notes:String(m.notes||'').slice(0,300)};
  const bad=Object.entries(row).filter(([,v])=>v===undefined).map(([k])=>k);if(bad.length)throw new Error('Revisa los valores: hay medidas fuera de rango.');
  if(['weight_kg','body_fat','waist_cm','chest_cm','arm_cm','thigh_cm','hip_cm'].every(k=>row[k]===null))throw new Error('Escribe al menos una medida.');
  const saved=await gq(gymClient.from('body_metrics').upsert({...row,user_id:GS.user.id},{onConflict:'user_id,date'}).select('id,date,weight_kg,body_fat,waist_cm,chest_cm,arm_cm,thigh_cm,hip_cm,notes').single());
  GS.metrics=[saved,...GS.metrics.filter(x=>x.date!==saved.date)].sort((a,b)=>b.date.localeCompare(a.date));return saved;
}
async function gymDeleteMetric(id){await gq(gymClient.from('body_metrics').delete().eq('id',id));GS.metrics=GS.metrics.filter(m=>m.id!==id)}
addEventListener('online',()=>{if(GS.user)gymFlushQueue().then(()=>typeof gRender==='function'&&gRender(false))});
