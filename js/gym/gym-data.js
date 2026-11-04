/* ---- Gym · capa de datos (Fase 1: solo lectura) ----
   - Sesión: usa la misma configuración pública de Supabase que la app principal (js/cloud-config.js).
     La sesión ya iniciada en Mi Centro se comparte porque ambas páginas viven en el mismo origen.
   - Datos reales disponibles hoy: las tareas de «Mi día» con categoría Gimnasio, leídas del
     almacenamiento local de la app. Esta página no escribe nada en ningún lado.
   - Fase 2 (pendiente): rutinas, entrenamientos, series, medidas y nutrición en tablas propias
     con RLS. Ver GYM_FASE2_PLAN.md. No hay tablas ni migraciones creadas todavía. */
const GYM_TZ='America/Bogota';
const gymToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:GYM_TZ}).format(new Date());
const gymAddDays=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const gymDow=d=>new Date(d+'T12:00:00Z').getUTCDay();

/* Un solo cliente por página. Si la librería no cargó (sin conexión), la página sigue funcionando. */
let gymClient=null;
try{if(window.supabase?.createClient)gymClient=window.supabase.createClient(CLOUD_URL,CLOUD_KEY)}catch(e){gymClient=null}

/* Estado de la cuenta, solo para mostrarlo. No inicia ni cierra sesión. */
async function gymSession(){
  if(!gymClient)return{state:'offline',user:null};
  try{const {data,error}=await gymClient.auth.getSession();if(error)return{state:'error',user:null};const u=data?.session?.user||null;return{state:u?'signed':'local',user:u}}
  catch(e){return{state:'error',user:null}}
}

/* Lee (sin modificar) los datos que la app principal guardó en este navegador. */
function gymReadLocalData(userId){
  const keys=userId?['mcc1-user-'+userId,'mcc1']:['mcc1'];
  for(const k of keys){try{const raw=localStorage.getItem(k);if(!raw)continue;const d=JSON.parse(raw);if(d&&typeof d==='object'&&d.inst&&typeof d.inst==='object')return d}catch(e){}}
  return null;
}
const isGymCategory=c=>String(c||'').trim().toLocaleLowerCase('es-CO')==='gimnasio';

/* Días con al menos una tarea de Gimnasio hecha, y lo programado (hecho o no) por día. */
function gymCheckins(data){
  const done=new Map(),planned=new Map();
  for(const [day,list] of Object.entries(data?.inst||{})){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Array.isArray(list))continue;
    const gym=list.filter(t=>t&&isGymCategory(t.cat));
    if(!gym.length)continue;
    planned.set(day,gym.length);
    const n=gym.filter(t=>t.done).length;if(n)done.set(day,n);
  }
  const routines=(Array.isArray(data?.routines)?data.routines:[]).filter(r=>r&&r.active&&isGymCategory(r.cat));
  return{done,planned,routines};
}
/* Resumen honesto: solo cuenta lo registrado. */
function gymSummary(data,extraDates=[]){
  const today=gymToday(),{done,planned,routines}=gymCheckins(data);
  /* Entrenamientos registrados en Gym (fechas de Bogotá) también cuentan como días entrenados. */
  extraDates.forEach(d=>{if(/^\d{4}-\d{2}-\d{2}$/.test(d))done.set(d,(done.get(d)||0)+1)});
  const dow=(gymDow(today)+6)%7,weekStart=gymAddDays(today,-dow);
  const week=Array.from({length:7},(_,i)=>{const d=gymAddDays(weekStart,i);return{date:d,done:done.has(d),planned:planned.has(d)||routines.some(r=>Array.isArray(r.days)&&r.days.includes(gymDow(d))&&(!r.from||d>=r.from)&&(!r.to||d<=r.to)),future:d>today,today:d===today}});
  const last30=[...done.keys()].filter(d=>d>gymAddDays(today,-30)&&d<=today).length;
  let streak=0;for(let i=0;i<120;i++){const w0=gymAddDays(weekStart,-7*i),has=Array.from({length:7},(_,j)=>gymAddDays(w0,j)).some(d=>done.has(d));if(has)streak++;else if(i>0)break;else continue}
  const lastDay=[...done.keys()].filter(d=>d<=today).sort().pop()||null;
  /* 12 semanas para el mapa de constancia (lunes a domingo). */
  const weeks=Array.from({length:12},(_,w)=>Array.from({length:7},(_,j)=>{const d=gymAddDays(weekStart,(w-11)*7+j);return{date:d,count:done.get(d)||0,future:d>today}}));
  return{today,week,weekDone:week.filter(x=>x.done).length,last30,streak,lastDay,weeks,routines,hasAny:done.size>0||planned.size>0||routines.length>0};
}
