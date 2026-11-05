/* ---- Gym Intelligence · recuperación (fase F): funciones puras ----
   Registro diario de sueño y sensaciones, tendencia con datos mínimos y lectura por músculo.
   Nunca afirma que un músculo está «recuperado»: el tiempo desde el último estímulo es un dato de análisis,
   no un diagnóstico. Sueño: 7 h o más para adultos de 18–60 años (AASM/SRS, Watson et al. 2015).
   Escalas 1–5: calidad del sueño y energía (5 = mejor); fatiga, dolor muscular y estrés (5 = peor). */

const GYM_SLEEP_MIN_H=7;
const GYM_REC_METRICS=[['sleep_h','Sueño','h',true],['sleep_quality','Calidad del sueño','/5',true],['energy','Energía','/5',true],['fatigue','Fatiga','/5',false],['soreness','Dolor muscular','/5',false],['stress','Estrés','/5',false]];

const grN=x=>String(x).replace('.',',');
function gymSleepHours(bed,wake){
  const m=t=>{const r=/^(\d{1,2}):(\d{2})$/.exec(String(t||''));return r&&+r[1]<24&&+r[2]<60?+r[1]*60+ +r[2]:null};
  const b=m(bed),w=m(wake);if(b===null||w===null)return null;
  let d=w-b;if(d<=0)d+=1440;return Math.round(d/6)/10;
}
/* Horas de sueño del registro: las escritas o, si faltan, calculadas con las horas de acostarse y levantarse. */
function gymLogSleep(l){return l&&l.sleep_h!==null&&l.sleep_h!==undefined&&l.sleep_h!==''?+l.sleep_h:gymSleepHours(l?.bed_time,l?.wake_time)}

/* Cómo llega la persona hoy. level: ok | caution | low | unknown. */
function gymReadiness(log){
  if(!log)return{level:'unknown',reasons:[],advice:'Registra cómo dormiste y cómo te sientes para ajustar las propuestas de hoy.'};
  const r=[],v=k=>log[k]===null||log[k]===undefined||log[k]===''?null:+log[k];let low=0;
  const sh=gymLogSleep(log);
  if(sh!==null&&sh<GYM_SLEEP_MIN_H){r.push(`Dormiste ${grN(sh)} h (la recomendación general para adultos es ${GYM_SLEEP_MIN_H} h o más).`);if(sh<5)low++}
  if(v('sleep_quality')!==null&&v('sleep_quality')<=2)r.push('Calidad de sueño baja.');
  if(v('energy')!==null&&v('energy')<=2)r.push('Energía baja.');
  if(v('fatigue')!==null&&v('fatigue')>=4)r.push('Fatiga alta.');
  if(v('soreness')!==null&&v('soreness')>=4)r.push('Dolor muscular alto.');
  if(v('stress')!==null&&v('stress')>=4)r.push('Estrés alto.');
  const filled=['sleep_quality','energy','fatigue','soreness','stress'].some(k=>v(k)!==null)||sh!==null;
  if(!filled)return{level:'unknown',reasons:[],advice:'Registra cómo dormiste y cómo te sientes para ajustar las propuestas de hoy.'};
  const level=low||r.length>=3?'low':r.length?'caution':'ok';
  const advice={ok:'Sin señales de alerta en lo que registraste.',caution:'Considera mantener las cargas hoy en lugar de subirlas.',low:'Hoy conviene una sesión suave o descansar. Si el malestar persiste, consulta a un profesional.'}[level];
  return{level,reasons:r,advice};
}

/* Tendencia: últimos 7 días frente a los 7 anteriores. Sin al menos 3 registros en cada semana no se compara. */
function gymRecoveryTrend(logs,today,{minN=3}={}){
  const add=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
  const curFrom=add(today,-6),prevFrom=add(today,-13),prevTo=add(today,-7);
  const out={};
  for(const [k] of GYM_REC_METRICS){
    const val=l=>k==='sleep_h'?gymLogSleep(l):(l[k]===null||l[k]===undefined||l[k]===''?null:+l[k]);
    const pick=(a,b)=>(logs||[]).filter(l=>l.date>=a&&l.date<=b).map(val).filter(x=>x!==null&&isFinite(x));
    const c=pick(curFrom,today),p=pick(prevFrom,prevTo),avg=a=>a.length?Math.round(a.reduce((s,x)=>s+x,0)/a.length*10)/10:null;
    const enough=c.length>=minN&&p.length>=minN;
    out[k]={cur:avg(c),prev:avg(p),n:c.length,nPrev:p.length,enough,delta:enough?Math.round((avg(c)-avg(p))*10)/10:null};
  }
  return out;
}

/* Lectura por músculo con lo entrenado (stats7 y stats30 de gymMuscleStats) y las molestias declaradas hoy. */
function gymMuscleRecovery(stats7,stats30,soreIds,today){
  const sore=new Set(soreIds||[]),rows=[];
  const days=d=>Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(d+'T12:00:00Z'))/864e5);
  for(const id in stats30||{}){
    const s30=stats30[id],s7=stats7?.[id];const last=s30.dates&&s30.dates.length?s30.dates[s30.dates.length-1]:null;
    if(!last&&!sore.has(id))continue;
    const d=last?days(last):null,ws=s7?s7.weightedSets:0,isSore=sore.has(id);
    let note;
    if(d===null)note='Sin estímulo registrado en 30 días.';
    else if(d<=1)note=d===0?'Estimulado hoy.':'Estimulado ayer.';
    else note=`Último estímulo hace ${d} días.`;
    let flag='none';
    if(isSore&&d!==null&&d<=2){flag='caution';note+=' Molestias declaradas: evita alta intensidad en este músculo hoy.'}
    else if(isSore){flag='info';note+=' Molestias declaradas.'}
    rows.push({id,name:s30.name,group:s30.group,daysSince:d,last,weightedSets7:ws,band:typeof gymStimulusBand==='function'?gymStimulusBand(ws):null,sore:isSore,flag,note});
  }
  return rows.sort((a,b)=>(a.flag==='caution'?-1:0)-(b.flag==='caution'?-1:0)||(a.daysSince??999)-(b.daysSince??999));
}

if(typeof module!=='undefined')module.exports={GYM_SLEEP_MIN_H,GYM_REC_METRICS,gymSleepHours,gymLogSleep,gymReadiness,gymRecoveryTrend,gymMuscleRecovery};
