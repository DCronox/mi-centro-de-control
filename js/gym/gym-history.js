/* ---- Gym Intelligence · historial y proyecciones (fase H): funciones puras ----
   - Resumen semanal (o diario en 7 días) de entrenamiento, nutrición, sueño y peso.
   - Proyecciones por regresión lineal con intervalo de predicción del 95 %.
   Regla: sin al menos 8 registros que abarquen 4 semanas NO se proyecta («sin base estadística suficiente»).
   Solo se proyectan peso corporal y 1RM estimado; nunca masa muscular ni % de grasa. */

const GH_RANGES={'7d':['7 días',7],'30d':['30 días',30],'90d':['3 meses',91],'6m':['6 meses',182],'12m':['12 meses',365]};
const GH_MIN_N=8,GH_MIN_SPAN=28;

const ghAdd=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const ghDiff=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5);
const ghWeek=date=>{const d=new Date(date+'T12:00:00Z'),dow=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-dow);return d.toISOString().slice(0,10)};
/* Fecha en Bogotá (UTC−5 fijo, sin horario de verano). Igual que gymDateOf; crear un Intl.DateTimeFormat por fila era lento. */
const ghDateOf=ts=>new Date((typeof ts==='number'?ts:Date.parse(ts))-5*3600000).toISOString().slice(0,10);

/* Valor t de Student bilateral al 95 % según grados de libertad (tabla estándar). */
function ghT95(df){
  const T=[[1,12.706],[2,4.303],[3,3.182],[4,2.776],[5,2.571],[6,2.447],[7,2.365],[8,2.306],[9,2.262],[10,2.228],[12,2.179],[15,2.131],[20,2.086],[30,2.042],[60,2.000],[120,1.980]];
  if(df<1)return Infinity;for(const [d,t] of T)if(df<=d)return t;return 1.96;
}

/* Ajuste lineal por mínimos cuadrados. points: [{x, y}] con x en días. */
function gymLinearFit(points){
  const n=points.length;if(n<2)return null;
  const mx=points.reduce((s,p)=>s+p.x,0)/n,my=points.reduce((s,p)=>s+p.y,0)/n;
  const sxx=points.reduce((s,p)=>s+(p.x-mx)**2,0);if(!(sxx>0))return null;
  const slope=points.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0)/sxx,icpt=my-slope*mx;
  const sse=points.reduce((s,p)=>s+(p.y-(icpt+slope*p.x))**2,0),s=n>2?Math.sqrt(sse/(n-2)):0;
  return{n,mx,my,sxx,slope,intercept:icpt,s,
    predict:x=>icpt+slope*x,
    interval:x=>{const t=ghT95(n-2),h=t*s*Math.sqrt(1+1/n+(x-mx)**2/sxx);return[icpt+slope*x-h,icpt+slope*x+h]}};
}

/* Proyección a `horizon` días desde la última fecha. series: [{date, value}] ordenada o no. */
function gymProjection(series,{horizon=28,minN=GH_MIN_N,minSpan=GH_MIN_SPAN}={}){
  const pts=(series||[]).filter(p=>p&&p.date&&isFinite(+p.value)).sort((a,b)=>a.date.localeCompare(b.date));
  if(!pts.length)return{enough:false,n:0,span:0,reason:'Sin registros.'};
  const first=pts[0].date,last=pts[pts.length-1].date,span=ghDiff(first,last);
  if(pts.length<minN||span<minSpan)return{enough:false,n:pts.length,span,reason:`Sin base estadística suficiente: hacen falta al menos ${minN} registros en ${Math.round(minSpan/7)} semanas (hay ${pts.length} en ${span} días).`};
  const fit=gymLinearFit(pts.map(p=>({x:ghDiff(first,p.date),y:+p.value})));
  if(!fit)return{enough:false,n:pts.length,span,reason:'No se puede calcular la tendencia con estos datos.'};
  const xEnd=span+horizon,[lo,hi]=fit.interval(xEnd),r=x=>Math.round(x*10)/10;
  return{enough:true,n:pts.length,span,first,last,horizon,
    perWeek:Math.round(fit.slope*7*100)/100,
    fitStart:r(fit.predict(0)),fitNow:r(fit.predict(span)),
    target:{date:ghAdd(last,horizon),value:r(fit.predict(xEnd)),lo:r(lo),hi:r(hi)},
    band:[0,Math.round(horizon/2),horizon].map(h=>{const x=span+h,[a,b]=fit.interval(x);return{date:ghAdd(last,h),value:r(fit.predict(x)),lo:r(a),hi:r(b)}}),
    residualSd:r(fit.s)};
}

/* Serie de peso (una por fecha). */
function gymWeightSeries(metrics,from,to){
  return(metrics||[]).filter(m=>m.weight_kg!==null&&m.weight_kg!==undefined&&m.weight_kg!==''&&m.date>=from&&m.date<=to).map(m=>({date:m.date,value:+m.weight_kg})).sort((a,b)=>a.date.localeCompare(b.date));
}
/* Serie de 1RM estimado (Epley, ≤12 repeticiones): el mejor de cada día para un ejercicio. */
function gymE1rmSeries(exerciseId,sessions,sets,from,to){
  const ses=new Map((sessions||[]).map(s=>[s.id,s])),by=new Map();
  for(const x of sets||[]){
    if(x.exercise_id!==exerciseId)continue;const s=ses.get(x.session_id);if(!s)continue;
    const d=ghDateOf(s.started_at);if(d<from||d>to)continue;
    const w=+x.weight_kg,r=+x.reps;if(!(w>0&&r>0&&r<=12))continue;
    const e=w*(1+r/30);if(!by.has(d)||e>by.get(d))by.set(d,e);
  }
  return[...by.entries()].map(([date,v])=>({date,value:Math.round(v*10)/10})).sort((a,b)=>a.date.localeCompare(b.date));
}

/* Resumen por periodo: días (rango de 7 días) o semanas (resto). Los promedios solo cuentan días con registro. */
function gymHistorySummary({sessions,sets,foods,recovery,metrics,from,to,daily=false}){
  const key=d=>daily?d:ghWeek(d),buckets=new Map();
  for(let d=daily?from:ghWeek(from);d<=to;d=ghAdd(d,daily?1:7))buckets.set(d,{period:d,sessions:0,volume:0,sets:0,kcalDays:new Map(),proteinDays:new Map(),sleep:[],weights:[]});
  const B=d=>buckets.get(key(d));
  const ses=new Map();(sessions||[]).forEach(s=>{const d=ghDateOf(s.started_at);if(d<from||d>to)return;ses.set(s.id,d);const b=B(d);if(b)b.sessions++});
  (sets||[]).forEach(x=>{const d=ses.get(x.session_id);if(!d)return;const b=B(d);if(b){b.sets++;b.volume+=(+x.weight_kg||0)*(+x.reps||0)}});
  (foods||[]).forEach(f=>{if(f.date<from||f.date>to)return;const b=B(f.date);if(!b)return;b.kcalDays.set(f.date,(b.kcalDays.get(f.date)||0)+(+f.kcal||0));b.proteinDays.set(f.date,(b.proteinDays.get(f.date)||0)+(+f.protein_g||0))});
  (recovery||[]).forEach(l=>{if(l.date<from||l.date>to)return;const b=B(l.date);if(!b)return;const h=typeof gymLogSleep==='function'?gymLogSleep(l):(l.sleep_h===null||l.sleep_h===undefined?null:+l.sleep_h);if(h!==null&&isFinite(h))b.sleep.push(h)});
  (metrics||[]).forEach(m=>{if(m.date<from||m.date>to||m.weight_kg===null||m.weight_kg===undefined)return;const b=B(m.date);if(b)b.weights.push(+m.weight_kg)});
  const avg=a=>a.length?Math.round(a.reduce((s,x)=>s+x,0)/a.length*10)/10:null;
  return[...buckets.values()].map(b=>({period:b.period,sessions:b.sessions,sets:b.sets,volume:Math.round(b.volume),
    loggedDays:b.kcalDays.size,kcalAvg:b.kcalDays.size?Math.round(avg([...b.kcalDays.values()])):null,proteinAvg:avg([...b.proteinDays.values()]),
    sleepAvg:avg(b.sleep),sleepN:b.sleep.length,weightAvg:avg(b.weights),weightN:b.weights.length}));
}

if(typeof module!=='undefined')module.exports={GH_RANGES,GH_MIN_N,GH_MIN_SPAN,ghT95,gymLinearFit,gymProjection,gymWeightSeries,gymE1rmSeries,gymHistorySummary};
