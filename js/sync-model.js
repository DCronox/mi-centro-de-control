/* ---- Modelo de sincronización: identidad de elementos, cambios y borrados ----
   Funciones puras (no tocan el DOM ni el estado global) para poder probarlas.
   - Cada elemento modificado lleva `u` (marca de tiempo en ms del último cambio).
   - Cada borrado deja una «lápida» en `deleted`: { 'coleccion|clave': ms }.
   - Al unir dos copias gana la versión con `u` más reciente; un borrado elimina el
     elemento salvo que este se haya modificado después (p. ej. al restaurar una copia).
   Los datos antiguos sin `u` ni `deleted` siguen siendo válidos. */
const defaultData=()=>({tx:[],goals:[],routines:[],inst:{},budgets:[],obligations:[],scheduledShifts:[],rate:13000,shifts:[],deleted:{}});
const SYNC_COLLECTIONS=['tx','goals','routines','budgets','obligations','scheduledShifts','shifts'];
const TOMBSTONE_TTL=400*24*60*60*1000;
const syncById=v=>v&&typeof v==='object'&&v.id!=null?'id:'+v.id:'j:'+JSON.stringify(v);
function syncKey(col,v){
  if(col==='tx'&&v&&v.obligationId&&v.obligationMonth)return 'ob:'+v.obligationId+':'+v.obligationMonth;
  if(col==='inst'&&v&&v.rid)return 'rid:'+v.rid+':'+v.date;
  return syncById(v);
}
/* Asegura `deleted` y da identificador estable a los aportes antiguos (sin id).
   El id se deriva del contenido para que dos dispositivos generen el mismo. */
function normalizeData(d){
  if(!d||typeof d!=='object')return d;
  if(!d.deleted||typeof d.deleted!=='object'||Array.isArray(d.deleted))d.deleted={};
  (Array.isArray(d.goals)?d.goals:[]).forEach(g=>{
    if(!g||!Array.isArray(g.aportes))return;
    const seen={};
    g.aportes.forEach(a=>{if(!a||typeof a!=='object'||a.id)return;const base=g.id+'|'+a.date+'|'+a.amount;seen[base]=(seen[base]||0)+1;a.id='ap-'+base+'|'+seen[base]});
  });
  return d;
}
/* Lista [clave global, elemento] de todo lo sincronizable. */
function syncEntries(d){
  const out=[];
  SYNC_COLLECTIONS.forEach(col=>(Array.isArray(d[col])?d[col]:[]).forEach(v=>out.push([col+'|'+syncKey(col,v),v])));
  Object.entries(d.inst&&typeof d.inst==='object'?d.inst:{}).forEach(([day,list])=>(Array.isArray(list)?list:[]).forEach(v=>out.push(['inst|'+day+'|'+syncKey('inst',v),v])));
  /* Registros dentro de cada meta (aportes de dinero y avances de metas personales). */
  (Array.isArray(d.goals)?d.goals:[]).forEach(g=>{if(!g||typeof g!=='object')return;GOAL_LOGS.forEach(f=>(Array.isArray(g[f])?g[f]:[]).forEach(x=>out.push([goalLogKey(f,g.id,x),x])))});
  return out;
}
const GOAL_LOGS=['aportes','progress'];
const goalLogKey=(field,goalId,x)=>'goal.'+field+'|'+goalId+'|'+syncById(x);
function syncSnapshot(d){return new Map(syncEntries(d).map(([k,v])=>[k,JSON.stringify(v)]))}
function pruneTombstones(deleted,now){Object.keys(deleted).forEach(k=>{if(!(now-(Number(deleted[k])||0)<TOMBSTONE_TTL))delete deleted[k]});return deleted}
/* Compara con la instantánea anterior: marca `u` en lo nuevo o modificado y deja
   lápidas para lo que desapareció. Devuelve la nueva instantánea. */
function trackChanges(d,baseline,now){
  normalizeData(d);
  const seen=new Set();
  syncEntries(d).forEach(([k,v])=>{seen.add(k);if(v&&typeof v==='object'&&baseline.get(k)!==JSON.stringify(v))v.u=now});
  baseline.forEach((_,k)=>{if(!seen.has(k))d.deleted[k]=now});
  pruneTombstones(d.deleted,now);
  return syncSnapshot(d);
}
/* Une dos copias sin perder nada y respetando borrados y la edición más reciente. */
function mergeData(remote,local){
  remote=normalizeData(Object.assign(defaultData(),remote));local=normalizeData(Object.assign(defaultData(),local));
  const out=Object.assign(defaultData(),remote,local);
  const ts=v=>Number(v&&v.u)||0;
  const pick=(a,b)=>{const ta=ts(a),tb=ts(b);if(ta!==tb)return tb>ta?b:a;return(b.done&&!a.done)?b:(a.done&&!b.done)?a:b};
  const deleted={};
  [remote.deleted,local.deleted].forEach(m=>Object.entries(m||{}).forEach(([k,t])=>{t=Number(t)||0;if(t>(deleted[k]||0))deleted[k]=t}));
  const union=(col,x,y,prefix,resolve=pick)=>{
    const m=new Map();
    (Array.isArray(x)?x:[]).forEach(v=>m.set(syncKey(col,v),v));
    (Array.isArray(y)?y:[]).forEach(v=>{const k=syncKey(col,v);m.set(k,m.has(k)?resolve(m.get(k),v):v)});
    return[...m.entries()].filter(([k,v])=>{const t=deleted[prefix+k];return !t||ts(v)>t}).map(([,v])=>v);
  };
  /* Una meta presente en ambas copias: campos de la versión más reciente y unión de sus registros
     (aportes y avances), respetando los registros borrados. */
  const mergeGoal=(a,b)=>{
    const w=pick(a,b),extra={};
    GOAL_LOGS.forEach(f=>{
      if(!Array.isArray(a[f])&&!Array.isArray(b[f]))return;
      const m=new Map();
      [a,b].forEach(g=>(Array.isArray(g[f])?g[f]:[]).forEach(x=>{const k=syncById(x);m.set(k,m.has(k)?pick(m.get(k),x):x)}));
      extra[f]=[...m.entries()].filter(([k,x])=>{const t=deleted['goal.'+f+'|'+w.id+'|'+k];return !t||ts(x)>t}).map(([,x])=>x).sort((p,q)=>String(p.date).localeCompare(String(q.date)));
    });
    return Object.assign({},w,extra);
  };
  /* Valores únicos (no listas) que llevan su propia marca `u`: gana el más reciente. */
  ['activeShift','notifPrefs'].forEach(k=>{const r=remote[k],l=local[k];if(r||l)out[k]=ts(r)>ts(l)?r:l});
  SYNC_COLLECTIONS.forEach(col=>{out[col]=union(col,remote[col],local[col],col+'|',col==='goals'?mergeGoal:pick)});
  const inst={},ri=remote.inst||{},li=local.inst||{};
  new Set([...Object.keys(ri),...Object.keys(li)]).forEach(day=>{inst[day]=union('inst',ri[day],li[day],'inst|'+day+'|')});
  out.inst=inst;
  out.deleted=pruneTombstones(deleted,Date.now());
  return out;
}
