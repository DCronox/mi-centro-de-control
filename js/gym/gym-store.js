/* ---- Gym · almacenamiento (Fase 2) ----
   Supabase (tablas gym_* y body_metrics, con RLS) usando el cliente de gym-data.js.
   - El entrenamiento en curso vive en el navegador (sobrevive a recargas y a quedarse sin señal).
   - Al terminarlo pasa a una cola local y se sube; si falla, se reintenta al volver la conexión.
   - Los ids de entrenamientos y series se generan aquí, así que reintentar nunca duplica. */
const gymUid=()=>globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g,()=>(Math.random()*16|0).toString(16));
const GS={user:null,ready:false,error:'',exercises:[],routines:[],sessions:[],sets:[],metrics:[],syncing:false,busy:false,schemaV2:false};
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
      gq(gymClient.from('gym_exercises').select('*').order('name')),
      gq(gymClient.from('gym_routines').select('id,name,days,items,position,archived,updated_at').eq('archived',false).order('position').order('created_at')),
      gq(gymClient.from('gym_sessions').select('id,routine_id,name,started_at,ended_at,notes').gte('started_at',since).order('started_at',{ascending:false})),
      gq(gymClient.from('body_metrics').select('id,date,weight_kg,body_fat,waist_cm,chest_cm,arm_cm,thigh_cm,hip_cm,notes').order('date',{ascending:false}).limit(400))
    ]);
    let sets=[];
    const ids=ses.map(s=>s.id);
    for(let i=0;i<ids.length;i+=150){sets=sets.concat(await gq(gymClient.from('gym_sets').select('id,session_id,exercise_id,set_index,weight_kg,reps,rpe').in('session_id',ids.slice(i,i+150))))}
    Object.assign(GS,{exercises:ex,routines:ro,sessions:ses,sets,metrics:met,ready:true,error:''});
    await gymDetectSchema();await gymLinkCatalog();
    return true;
  }catch(e){GS.error=gymErr(e);GS.ready=false;return false}
}
const gymExercise=id=>GS.exercises.find(e=>e.id===id)||null;
/* ¿Existen las columnas catalog_key y muscles (migración 20261105_gym_catalogo)? Sin ellas Gym sigue
   funcionando y clasifica por nombre del catálogo o por grupo. */
async function gymDetectSchema(){const r=await gymClient.from('gym_exercises').select('catalog_key,muscles').limit(1);GS.schemaV2=!r.error;return GS.schemaV2}
/* Enlaza al catálogo los ejercicios antiguos cuyo nombre coincide exactamente (una sola vez). */
async function gymLinkCatalog(){
  if(!GS.schemaV2)return;
  for(const e of GS.exercises){if(e.catalog_key)continue;const c=gymCatalogByName(e.name);if(!c)continue;
    const r=await gymClient.from('gym_exercises').update({catalog_key:c.key}).eq('id',e.id);if(!r.error)e.catalog_key=c.key}
}

/* Ejercicios: crea uno (o reutiliza el que ya tenga ese nombre). */
/* Crea un ejercicio o reutiliza el existente. Si el nombre está en el catálogo se enlaza por su clave
   (clasificación muscular estructurada); si no, se guarda la clasificación elegida (principal/secundario). */
async function gymEnsureExercise(name,{primary=null,secondary=null}={}){
  name=String(name||'').trim().slice(0,80);if(!name)throw new Error('Escribe el nombre del ejercicio.');
  const cat=gymCatalogByName(name);if(cat)name=cat.name;
  const found=GS.exercises.find(e=>gymNorm(e.name)===gymNorm(name)||(cat&&e.catalog_key===cat.key));
  if(found){if(found.archived){await gq(gymClient.from('gym_exercises').update({archived:false}).eq('id',found.id));found.archived=false}return found}
  if(!cat&&!primary)throw new Error('Elige el músculo principal: «'+name+'» no está en el catálogo.');
  const muscles=cat?{}:Object.fromEntries([[primary,'P'],...(secondary&&secondary!==primary?[[secondary,'S']]:[])]);
  /* Grupo antiguo (columna muscle) solo como referencia; la clasificación real va en catalog_key/muscles. */
  const group=cat?cat.group:(Object.entries(GYM_GROUP_PRIMARY).find(([,m])=>m===primary)?.[0]||({deltoide_anterior:'Hombros',deltoide_posterior:'Hombros',trapecio:'Espalda',romboides:'Espalda',erectores:'Espalda',braquial:'Bíceps',oblicuos:'Abdomen',aductores:'Cuádriceps',soleo:'Pantorrillas'})[primary]||'Otro');
  const body={name,muscle:GYM_MUSCLES.includes(group)?group:'Otro'};
  if(GS.schemaV2){if(cat)body.catalog_key=cat.key;else body.muscles=muscles}
  else if(!cat)body.notes=('Músculos: '+Object.entries(muscles).map(([m,r])=>m+':'+r).join(',')).slice(0,300);
  const row=await gq(gymClient.from('gym_exercises').insert(body).select('*').single());
  GS.exercises.push(row);GS.exercises.sort((a,b)=>a.name.localeCompare(b.name,'es-CO'));return row;
}
async function gymUpdateExercise(id,patch){const row=await gq(gymClient.from('gym_exercises').update(patch).eq('id',id).select('*').single());Object.assign(gymExercise(id),row);return row}

/* Rutinas. items: [{exercise_id,sets,reps_min,reps_max,rest_s,notes}] */
function gymCleanItems(items){return(items||[]).filter(i=>i&&i.exercise_id).slice(0,40).map(i=>({exercise_id:i.exercise_id,sets:Math.min(20,Math.max(1,Math.round(+i.sets||3))),reps_min:Math.min(100,Math.max(1,Math.round(+i.reps_min||8))),reps_max:Math.min(100,Math.max(1,Math.round(+i.reps_max||+i.reps_min||12))),rest_s:Math.min(900,Math.max(0,Math.round(+i.rest_s||90))),notes:String(i.notes||'').slice(0,120)}))}
/* Guardar con bloqueo: un doble clic no crea dos rutinas. */
async function gymSaveRoutine(r){
  if(GS.busy)return null;GS.busy=true;
  try{return await gymSaveRoutineInner(r)}finally{GS.busy=false}
}
async function gymSaveRoutineInner(r){
  const body={name:String(r.name||'').trim().slice(0,60)||'Rutina',days:[...new Set((r.days||[]).map(Number).filter(d=>d>=0&&d<=6))].sort(),items:gymCleanItems(r.items),position:Number.isFinite(+r.position)?+r.position:GS.routines.length};
  if(r.id){const row=await gq(gymClient.from('gym_routines').update(body).eq('id',r.id).select('id,name,days,items,position,archived,updated_at').single());GS.routines=GS.routines.map(x=>x.id===row.id?row:x);return row}
  const row=await gq(gymClient.from('gym_routines').insert(body).select('id,name,days,items,position,archived,updated_at').single());GS.routines.push(row);return row;
}
/* Eliminar rutina: borra solo la rutina. Los entrenamientos hechos con ella se conservan
   (gym_sessions.routine_id pasa a null por «on delete set null») y mantienen su nombre. */
async function gymDeleteRoutine(id){await gq(gymClient.from('gym_routines').delete().eq('id',id));GS.routines=GS.routines.filter(r=>r.id!==id);GS.sessions.forEach(s=>{if(s.routine_id===id)s.routine_id=null})}

/* ---- Entrenamiento en curso (local) ---- */
const gymActive=()=>gRead('active',null);
function gymSetActive(w){gWrite('active',w)}
function gymStartWorkout(routine){
  if(!GS.user)throw new Error('Inicia sesión para entrenar.');
  const items=routine?gymCleanItems(routine.items):[];
  const w={id:gymUid(),routine_id:routine?.id||null,name:routine?.name||'Entrenamiento libre',started_at:new Date().toISOString(),
    exercises:items.map(it=>{const last=gymLastPerformance(it.exercise_id,GS.sessions,GS.sets);return{exercise_id:it.exercise_id,target:it,sets:Array.from({length:it.sets},(_,i)=>({id:gymUid(),weight_kg:last?.sets[i]?.weight_kg??last?.sets.at(-1)?.weight_kg??'',reps:'',done:false}))}})};
  gymSetActive(w);return w;
}
function gymAddExerciseToActive(exerciseId){const w=gymActive();if(!w)return;const last=gymLastPerformance(exerciseId,GS.sessions,GS.sets);w.exercises.push({exercise_id:exerciseId,target:{sets:3,reps_min:8,reps_max:12,rest_s:90},sets:Array.from({length:3},(_,i)=>({id:gymUid(),weight_kg:last?.sets[i]?.weight_kg??last?.sets.at(-1)?.weight_kg??'',reps:'',done:false}))});gymSetActive(w)}

/* Termina: pasa a la cola y la sube. Devuelve {saved, queued, sets}. */
async function gymFinishWorkout(){
  const w=gymActive();if(!w)return{saved:false,queued:false,sets:0};
  const sets=[];w.exercises.forEach(ex=>{let n=0;ex.sets.forEach(s=>{if(!s.done)return;const reps=Math.round(+s.reps),kg=Math.round((+s.weight_kg||0)*100)/100;if(!(reps>=0&&reps<=500)||!(kg>=0&&kg<=1000))return;const rpe=s.rpe===''||s.rpe===null||s.rpe===undefined?null:Math.min(10,Math.max(1,Math.round(+s.rpe*2)/2));sets.push({id:s.id,session_id:w.id,exercise_id:ex.exercise_id,set_index:++n,weight_kg:kg,reps,rpe:Number.isFinite(rpe)?rpe:null})})});
  const payload={session:{id:w.id,routine_id:w.routine_id,name:String(w.name||'').slice(0,60),started_at:w.started_at,ended_at:new Date().toISOString(),notes:String(w.notes||'').slice(0,500)},sets};
  const q=gRead('queue',[]);q.push(payload);gWrite('queue',q);gymSetActive(null);
  const ok=await gymFlushQueue();
  const volume=sets.reduce((a,x)=>a+x.weight_kg*x.reps,0),minutes=Math.max(1,Math.round((Date.parse(payload.session.ended_at)-Date.parse(w.started_at))/60000));
  return{saved:ok&&!gRead('queue',[]).some(p=>p.session.id===w.id),queued:true,sets:sets.length,volume:Math.round(volume),minutes,exercises:new Set(sets.map(x=>x.exercise_id)).size};
}
function gymDiscardWorkout(){gymSetActive(null)}
/* Sube lo pendiente. upsert por id: si un intento anterior quedó a medias, no se duplica nada. */
async function gymFlushQueue(){
  if(!gymClient||!GS.user)return false;
  if(GS.syncing){await new Promise(r=>setTimeout(r,300));if(GS.syncing)return false}
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

/* ---- Evaluación inicial y objetivos nutricionales (Gym Intelligence, fase B) ----
   Tablas gym_profiles y nutrition_targets (migración 20261106_gym_perfil). Si aún no existen, Gym sigue
   funcionando: la evaluación se puede calcular en el dispositivo pero no se guarda. */
GS.profile=null;GS.targets=[];GS.profileSchema=null;
const GYM_PROFILE_FIELDS=['birth_year','sex','height_cm','weight_kg','goal','secondary_goals','experience','occupation','walking','training_days','session_min','cardio_min_week','equipment','sleep_hours','pregnant','lactating','condition','medication','eating_disorder','notes'];
async function gymLoadProfile(){
  if(!gymClient||!GS.user)return false;
  const p=await gymClient.from('gym_profiles').select('*').eq('user_id',GS.user.id).maybeSingle();
  if(p.error){GS.profileSchema=!/schema cache|does not exist|relation/i.test(p.error.message||'')?true:false;GS.profile=null;GS.targets=[];return false}
  GS.profileSchema=true;GS.profile=p.data||null;
  const t=await gymClient.from('nutrition_targets').select('*').eq('user_id',GS.user.id).order('created_at',{ascending:false}).limit(50);
  GS.targets=t.error?[]:[...(t.data||[])].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  return true;
}
/* Fila de la base de datos → entrada del motor de cálculo. */
function gymProfileInput(row){
  if(!row)return null;
  return{birth_year:+row.birth_year,sex:row.sex,height_cm:+row.height_cm,weight_kg:+row.weight_kg,goal:row.goal,experience:row.experience,occupation:row.occupation,walking:row.walking,
    training_days:+row.training_days,session_min:+row.session_min,cardio_min_week:+(row.cardio_min_week||0),equipment:row.equipment,sleep_hours:row.sleep_hours===null||row.sleep_hours===undefined||row.sleep_hours===''?null:+row.sleep_hours,
    safety:{pregnant:!!row.pregnant,lactating:!!row.lactating,condition:!!row.condition,medication:!!row.medication,eating_disorder:!!row.eating_disorder}};
}
/* Formulario → fila normalizada. */
function gymProfileRow(v){
  const num=x=>x===''||x===undefined||x===null?null:+x,b=x=>x===true||x==='on'||x==='1'||x==='true';
  return{birth_year:num(v.birth_year),sex:v.sex,height_cm:num(v.height_cm),weight_kg:num(v.weight_kg),goal:v.goal,secondary_goals:[].concat(v.secondary_goals||[]).filter(g=>g&&g!==v.goal),
    experience:v.experience,occupation:v.occupation,walking:v.walking,training_days:num(v.training_days),session_min:num(v.session_min),cardio_min_week:num(v.cardio_min_week)||0,
    equipment:v.equipment||'gym',sleep_hours:num(v.sleep_hours),pregnant:b(v.pregnant),lactating:b(v.lactating),condition:b(v.condition),medication:b(v.medication),eating_disorder:b(v.eating_disorder),notes:String(v.notes||'').slice(0,500)};
}
async function gymSaveProfile(row){
  if(!GS.profileSchema)throw new Error('La evaluación aún no se puede guardar: falta aplicar la actualización de la base de datos de Gym.');
  const body={...row,user_id:GS.user.id,assessment_version:1,completed_at:new Date().toISOString()};
  const saved=await gq(gymClient.from('gym_profiles').upsert(body,{onConflict:'user_id'}).select('*').single());
  GS.profile=saved;return saved;
}
const gymActiveTarget=()=>GS.targets.find(t=>t.status==='accepted'||t.status==='manual')||null;
/* Guarda un objetivo nuevo (nunca sobrescribe): el anterior vigente pasa a «superseded». */
async function gymSaveTarget(result,{status='accepted',manual=null}={}){
  if(!GS.profileSchema)throw new Error('Los objetivos aún no se pueden guardar: falta aplicar la actualización de la base de datos de Gym.');
  if(!result||!result.ok||!result.energy)throw new Error('No hay un objetivo calculado que guardar.');
  const m=manual||{};
  const row={user_id:GS.user.id,status,
    kcal:Math.round(m.kcal??result.energy.kcal),protein_g:Math.round(m.protein_g??result.macros.protein),carbs_g:Math.round(m.carbs_g??result.macros.carbs),fat_g:Math.round(m.fat_g??result.macros.fat),
    fiber_g:Math.round(m.fiber_g??result.macros.fiber),water_ml:Math.round((m.water_l??result.water.liters)*1000),
    method:'mifflin_stjeor+pal',engine_version:result.version,
    details:{input:gymProfileInput(GS.profile),computed:{energy:result.energy,macros:result.macros,water:result.water},warnings:result.warnings,refs:result.refs,safety:result.safety.mode,manual:!!manual}};
  const prev=gymActiveTarget();
  const saved=await gq(gymClient.from('nutrition_targets').insert(row).select('*').single());
  if(prev){const r=await gymClient.from('nutrition_targets').update({status:'superseded'}).eq('id',prev.id);if(!r.error)prev.status='superseded'}
  GS.targets.unshift(saved);return saved;
}
/* Borra la evaluación y todo el historial de objetivos de la persona (acción explícita del usuario). */
async function gymDeleteProfileData(){
  await gq(gymClient.from('nutrition_targets').delete().eq('user_id',GS.user.id));
  await gq(gymClient.from('gym_profiles').delete().eq('user_id',GS.user.id));
  GS.profile=null;GS.targets=[];
}

/* ---- Registro de comidas y agua (fase C; tablas food_logs y water_logs, migración 20261107) ----
   Se cargan los últimos 35 días; los días anteriores se piden al navegar hacia ellos. */
GS.foods=[];GS.water=[];GS.nutriSchema=null;GS.nutriFrom=null;
const GYM_FOOD_COLS='id,date,meal,name,quantity,unit,grams,kcal,protein_g,carbs_g,fat_g,fiber_g,source,source_ref,original_text,estimated,created_at';
async function gymLoadNutrition(from,to){
  if(!gymClient||!GS.user)return false;
  to=to||gymToday();from=from||gymAddDays(to,-34);
  const [f,w]=await Promise.all([
    gymClient.from('food_logs').select(GYM_FOOD_COLS).eq('user_id',GS.user.id).gte('date',from).lte('date',to).order('created_at'),
    gymClient.from('water_logs').select('id,date,ml,created_at').eq('user_id',GS.user.id).gte('date',from).lte('date',to).order('created_at')]);
  const err=f.error||w.error;
  if(err){GS.nutriSchema=/schema cache|does not exist|relation/i.test(err.message||'')?false:GS.nutriSchema;return false}
  GS.nutriSchema=true;
  const inRange=x=>x.date>=from&&x.date<=to;
  GS.foods=GS.foods.filter(x=>!inRange(x)).concat((f.data||[]).filter(inRange));
  GS.water=GS.water.filter(x=>!inRange(x)).concat((w.data||[]).filter(inRange));
  if(!GS.nutriFrom||from<GS.nutriFrom)GS.nutriFrom=from;
  return true;
}
/* Asegura que haya datos de la semana que termina en `date` (y la anterior, para comparar). */
async function gymEnsureNutritionFor(date){const from=gymAddDays(date,-13);if(GS.nutriFrom&&from>=GS.nutriFrom)return true;return gymLoadNutrition(from,GS.nutriFrom?gymAddDays(GS.nutriFrom,-1):date)}
function gymNutriGuard(){if(!GS.nutriSchema)throw new Error('El registro de comidas aún no se puede guardar: falta aplicar la actualización de la base de datos de Gym.')}
async function gymAddFood(v){
  gymNutriGuard();
  const errs=gymValidateFood(v);if(errs.length)throw new Error(errs.join(' '));
  const kc=gymFoodKcal(v),n=x=>x===''||x===undefined||x===null?0:Math.round(+x*10)/10;
  const row={user_id:GS.user.id,date:v.date,meal:v.meal,name:String(v.name).trim().slice(0,120),quantity:v.quantity===''||v.quantity===undefined?null:+v.quantity,unit:String(v.unit||'').slice(0,30),
    grams:v.grams===''||v.grams===undefined?null:+v.grams,kcal:kc.kcal,protein_g:n(v.protein_g),carbs_g:n(v.carbs_g),fat_g:n(v.fat_g),fiber_g:n(v.fiber_g),
    source:'manual',estimated:kc.derived||!!v.estimated};
  const saved=await gq(gymClient.from('food_logs').insert(row).select(GYM_FOOD_COLS).single());
  GS.foods.push(saved);return saved;
}
async function gymDeleteFood(id){gymNutriGuard();await gq(gymClient.from('food_logs').delete().eq('id',id));GS.foods=GS.foods.filter(f=>f.id!==id)}
async function gymAddWater(date,ml){
  gymNutriGuard();ml=Math.round(+ml);if(!(ml>=1&&ml<=5000))throw new Error('Cantidad de agua no válida.');
  const saved=await gq(gymClient.from('water_logs').insert({user_id:GS.user.id,date,ml}).select('id,date,ml,created_at').single());
  GS.water.push(saved);return saved;
}
async function gymUndoWater(date){
  gymNutriGuard();const last=GS.water.filter(w=>w.date===date).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))).at(-1);if(!last)return null;
  await gq(gymClient.from('water_logs').delete().eq('id',last.id));GS.water=GS.water.filter(w=>w.id!==last.id);return last;
}
