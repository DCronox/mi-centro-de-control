/* ---- Gym Intelligence · recomendaciones integradas (fase G): funciones puras ----
   Cada recomendación: observación → datos usados → conclusión → acción → confianza.
   Regla de oro: ninguna sale sin los datos mínimos que la respaldan (se indican en cada regla).
   Se recalculan con los datos actuales; no se guardan en la base de datos.
   Tipos: 'observation' (lo que pasa), 'estimation' (cálculo con incertidumbre), 'recommendation' (qué hacer). */

const giN=(x,d=1)=>(Math.round((+x||0)*10**d)/10**d).toLocaleString('es-CO',{maximumFractionDigits:d});
const giAdd=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const giDays=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5);

/* Ritmo de cambio de peso por regresión lineal (kg/semana y % del peso por semana).
   Mínimo: 4 mediciones que abarquen 14 días o más. */
function gymWeightRate(metrics,today,{days=28}={}){
  const from=giAdd(today,-(days-1));
  const pts=(metrics||[]).filter(m=>m.weight_kg!==null&&m.weight_kg!==undefined&&m.weight_kg!==''&&m.date>=from&&m.date<=today)
    .map(m=>({x:giDays(from,m.date),y:+m.weight_kg})).sort((a,b)=>a.x-b.x);
  const span=pts.length?pts[pts.length-1].x-pts[0].x:0;
  if(pts.length<4||span<14)return{enough:false,n:pts.length,span};
  const n=pts.length,mx=pts.reduce((s,p)=>s+p.x,0)/n,my=pts.reduce((s,p)=>s+p.y,0)/n;
  const sxx=pts.reduce((s,p)=>s+(p.x-mx)**2,0),sxy=pts.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0);
  const slope=sxy/sxx,kgWeek=slope*7,pctWeek=kgWeek/my*100;
  const resid=pts.reduce((s,p)=>s+(p.y-(my+slope*(p.x-mx)))**2,0),se=n>2?Math.sqrt(resid/(n-2)/sxx)*7:null;
  return{enough:true,n,span,kgWeek:Math.round(kgWeek*100)/100,pctWeek:Math.round(pctWeek*100)/100,seWeek:se===null?null:Math.round(se*100)/100,mean:Math.round(my*10)/10,
    confidence:n>=8&&span>=21?'alta':'media'};
}

/* Genera las recomendaciones. ctx (todo precalculado para que sea puro y comprobable):
   { today, goal, target:{kcal,protein_g,water_ml}|null, week: gymWeekNutrition(), waterDays:[{ml}] (días con agua registrada),
     weightRate: gymWeightRate(), lastWeightDate, sessions14, plannedPerWeek, muscles14:[{name,group,weightedSets}],
     progressions:[{name,action,weight}], sleep:{cur,n}, readiness:{level,reasons} } */
function gymInsights(ctx){
  const out=[],c=ctx||{},t=c.target,wk=c.week;
  const add=o=>out.push({priority:2,...o});

  /* 1. Proteína: ≥3 días con registro y objetivo en 7 días. */
  if(t&&wk&&wk.withTarget>=3&&wk.avg){
    const avg=wk.avg.protein_g,goal=t.protein_g,hit=wk.proteinHit,n=wk.withTarget;
    if(hit<n/2&&avg<goal*0.9)add({key:'protein-low',type:'recommendation',area:'nutrition',priority:1,
      title:'Tu proteína está por debajo del objetivo',
      observation:`Promedio de ${giN(avg,0)} g al día frente a ${giN(goal,0)} g de objetivo.`,
      data:[`${n} días con registro y objetivo en los últimos 7`,`Días con ≥90 % de la proteína: ${hit} de ${n}`],
      conclusion:'Con menos proteína de la prevista es más difícil conservar o ganar masa muscular.',
      action:{label:'Ver nutrición',tab:'nutricion',text:'Añade una fuente de proteína en 1–2 comidas (huevos, lácteos, carnes, legumbres).'},confidence:n>=5?'alta':'media'});
  }
  /* 2. Calorías frente al objetivo: ≥4 días con registro y objetivo. */
  if(t&&wk&&wk.withTarget>=4&&wk.avg){
    const avg=wk.avg.kcal,goal=t.kcal,r=avg/goal;
    if(c.goal==='fat_loss'&&r>1.1)add({key:'kcal-over-loss',type:'observation',area:'nutrition',
      title:'Comes por encima de tu objetivo de pérdida de grasa',observation:`Promedio de ${giN(avg,0)} kcal frente a ${giN(goal,0)} kcal (${Math.round(r*100)} %).`,
      data:[`${wk.withTarget} días con registro en 7`,'Solo cuenta lo registrado: si olvidaste comidas, el promedio real es mayor'],
      conclusion:'Con este promedio la pérdida será más lenta que la prevista.',action:{label:'Ver nutrición',tab:'nutricion',text:'Revisa qué comidas suman más calorías.'},confidence:'media'});
    else if(c.goal==='muscle_gain'&&r<0.9)add({key:'kcal-under-gain',type:'observation',area:'nutrition',
      title:'Comes por debajo de tu objetivo para ganar masa',observation:`Promedio de ${giN(avg,0)} kcal frente a ${giN(goal,0)} kcal (${Math.round(r*100)} %).`,
      data:[`${wk.withTarget} días con registro en 7`,'Si olvidaste registrar comidas, la diferencia real puede ser menor'],
      conclusion:'Un déficit sostenido dificulta ganar masa muscular.',action:{label:'Ver nutrición',tab:'nutricion',text:'Añade un tentempié o aumenta un poco las porciones.'},confidence:'media'});
  }
  /* 3. Peso frente al objetivo: regresión con ≥4 medidas en ≥14 días. Es una estimación. */
  const wr=c.weightRate;
  if(wr&&wr.enough&&c.goal){
    const data=[`${wr.n} mediciones en ${wr.span} días`,`Ritmo estimado: ${wr.kgWeek>0?'+':''}${giN(wr.kgWeek,2)} kg/semana (${wr.pctWeek>0?'+':''}${giN(wr.pctWeek,2)} %)${wr.seWeek!==null?` ± ${giN(wr.seWeek,2)}`:''}`];
    if(c.goal==='fat_loss'&&wr.pctWeek>-0.1)add({key:'weight-flat-loss',type:'estimation',area:'body',priority:1,
      title:'Tu peso no está bajando',observation:`En las últimas semanas tu peso ${wr.pctWeek>0.1?'sube':'se mantiene'} pese al objetivo de perder grasa.`,data,
      conclusion:'Si se mantiene 2–3 semanas más, conviene revisar el objetivo de calorías o el registro de comidas.',action:{label:'Revisar objetivos',tab:'perfil',text:'Comprueba que registras todo y revisa el objetivo en Perfil.'},confidence:wr.confidence});
    else if(c.goal==='fat_loss'&&wr.pctWeek<-1)add({key:'weight-fast-loss',type:'estimation',area:'body',priority:1,
      title:'Estás bajando de peso muy rápido',observation:`Pierdes más del 1 % de tu peso por semana.`,data,
      conclusion:'Un ritmo tan rápido aumenta el riesgo de perder masa muscular (Helms 2014; Roberts 2020).',action:{label:'Revisar objetivos',tab:'perfil',text:'Considera comer un poco más.'},confidence:wr.confidence});
    else if(c.goal==='muscle_gain'&&wr.pctWeek<0)add({key:'weight-down-gain',type:'estimation',area:'body',priority:1,
      title:'Tu peso baja aunque buscas ganar masa',observation:'La tendencia de tu peso es descendente.',data,
      conclusion:'Para ganar masa muscular suele hacer falta un pequeño superávit.',action:{label:'Ver nutrición',tab:'nutricion',text:'Revisa si llegas a tu objetivo de calorías.'},confidence:wr.confidence});
    else if(c.goal==='muscle_gain'&&wr.pctWeek>0.5)add({key:'weight-fast-gain',type:'estimation',area:'body',
      title:'Ganas peso más rápido de lo previsto',observation:'Subes más del 0,5 % de tu peso por semana.',data,
      conclusion:'Un ritmo alto suele traer más ganancia de grasa (Iraki 2019).',action:{label:'Revisar objetivos',tab:'perfil',text:'Considera reducir un poco el superávit.'},confidence:wr.confidence});
  }
  /* 4. Falta de peso reciente con objetivo activo. */
  if(t&&c.goal&&c.goal!=='maintenance'){
    const d=c.lastWeightDate?giDays(c.lastWeightDate,c.today):null;
    if(d===null||d>14)add({key:'weight-missing',type:'recommendation',area:'body',priority:3,
      title:'Registra tu peso',observation:d===null?'No hay mediciones de peso.':`Tu última medición fue hace ${d} días.`,
      data:[d===null?'0 mediciones':`Última: ${c.lastWeightDate}`],conclusion:'Sin mediciones regulares no se puede comprobar si el objetivo funciona.',
      action:{label:'Registrar peso',tab:'fisico',text:'Pésate 2–3 veces por semana, en ayunas y en condiciones parecidas.'},confidence:'alta'});
  }
  /* 5. Constancia: sesiones de 14 días frente a lo planificado. */
  if(c.plannedPerWeek>0&&c.sessions14!==undefined){
    const planned=c.plannedPerWeek*2;
    if(c.sessions14<planned*0.5)add({key:'consistency-low',type:'observation',area:'training',
      title:'Entrenas menos de lo planificado',observation:`${c.sessions14} entrenamientos en 14 días frente a ${planned} planificados.`,
      data:[`Plan: ${c.plannedPerWeek} días por semana`,`Registrados: ${c.sessions14} en 14 días`],conclusion:'La constancia es lo que más influye en el progreso.',
      action:{label:'Ver rutinas',tab:'rutinas',text:'Si tu semana no da para más, ajusta la rutina a menos días.'},confidence:'alta'});
  }
  /* 6. Músculos sin estímulo o con volumen muy alto (con ≥4 sesiones en 14 días). */
  if(c.sessions14>=4&&Array.isArray(c.muscles14)){
    const groups=new Map();c.muscles14.forEach(m=>{groups.set(m.group,(groups.get(m.group)||0)+m.weightedSets)});
    const zero=['Pecho','Espalda','Piernas','Hombros'].filter(g=>groups.has(g)&&groups.get(g)===0);
    if(zero.length)add({key:'muscles-zero',type:'observation',area:'training',
      title:`Sin series de ${zero.join(', ').toLowerCase()} en 14 días`,observation:'Algunos grupos grandes no recibieron estímulo en las últimas dos semanas.',
      data:[`${c.sessions14} entrenamientos en 14 días`,...zero.map(g=>`${g}: 0 series ponderadas`)],conclusion:'Si es intencional (lesión, prioridad), ignóralo.',
      action:{label:'Ver mapa muscular',tab:'progreso',text:'Considera añadir 1–2 ejercicios para esos grupos.'},confidence:'alta'});
    const high=c.muscles14.filter(m=>m.weightedSets/2>20);
    if(high.length)add({key:'muscles-high',type:'observation',area:'training',
      title:'Volumen muy alto en algunos músculos',observation:`Más de 20 series ponderadas por semana en ${high.map(m=>m.name.toLowerCase()).join(', ')}.`,
      data:high.map(m=>`${m.name}: ${giN(m.weightedSets/2)} series/semana (media de 14 días)`),conclusion:'Es un volumen alto: vigila si la fatiga aumenta o el rendimiento baja.',
      action:{label:'Ver recuperación',tab:'recuperacion',text:'Vigila fatiga y rendimiento en esos músculos.'},confidence:'media'});
  }
  /* 7. Progresión: ejercicios listos para subir y estancados (según el motor de la fase E). */
  const prog=c.progressions||[];
  const up=prog.filter(p=>p.action==='increase'),down=prog.filter(p=>p.action==='reduce');
  if(up.length)add({key:'prog-up',type:'recommendation',area:'training',
    title:`${up.length===1?'1 ejercicio listo':up.length+' ejercicios listos'} para subir peso`,observation:'Completaste el rango de repeticiones con el esfuerzo previsto.',
    data:up.map(p=>`${p.name}: ${p.title}`),conclusion:'Es buen momento para aplicar la doble progresión.',action:{label:'Entrenar',tab:'entrenar',text:'Al entrenar, pulsa «Usar» en la propuesta de cada ejercicio.'},confidence:'alta'});
  if(down.length)add({key:'prog-down',type:'recommendation',area:'training',priority:1,
    title:`${down.length===1?'1 ejercicio estancado':down.length+' ejercicios estancados'}`,observation:'Dos sesiones seguidas sin llegar al mínimo del rango con el mismo peso.',
    data:down.map(p=>`${p.name}: ${p.title}`),conclusion:'Bajar un poco el peso o descansar más suele desbloquear la progresión.',action:{label:'Ver recuperación',tab:'recuperacion',text:'Revisa también tu sueño y fatiga.'},confidence:'media'});
  /* 8. Sueño: ≥3 registros en 7 días con media < 7 h (AASM/SRS 2015). */
  if(c.sleep&&c.sleep.n>=3&&c.sleep.cur!==null&&c.sleep.cur<7)add({key:'sleep-low',type:'recommendation',area:'recovery',priority:1,
    title:'Duermes menos de 7 horas',observation:`Promedio de ${giN(c.sleep.cur)} h en los últimos 7 días.`,data:[`${c.sleep.n} registros de sueño`,'Recomendación general para adultos: 7 h o más (AASM/SRS 2015)'],
    conclusion:'Dormir poco empeora la recuperación y el rendimiento.',action:{label:'Ver recuperación',tab:'recuperacion',text:'Intenta acostarte a una hora fija.'},confidence:'media'});
  /* 9. Estado de hoy. */
  if(c.readiness&&c.readiness.level==='low')add({key:'readiness-low',type:'observation',area:'recovery',priority:1,
    title:'Hoy conviene una sesión suave',observation:'Lo que registraste hoy muestra varias señales de cansancio.',data:c.readiness.reasons,
    conclusion:'Las propuestas de carga de hoy no sugieren subir peso.',action:{label:'Ver recuperación',tab:'recuperacion',text:'Prioriza descansar.'},confidence:'media'});
  /* 10. Agua: ≥3 días con agua registrada y media < 70 % del objetivo. */
  if(t&&t.water_ml&&Array.isArray(c.waterDays)&&c.waterDays.length>=3){
    const avg=c.waterDays.reduce((s,d)=>s+d.ml,0)/c.waterDays.length;
    if(avg<t.water_ml*0.7)add({key:'water-low',type:'recommendation',area:'nutrition',priority:3,
      title:'Bebes poca agua',observation:`Promedio de ${giN(avg/1000,1)} L frente a ${giN(t.water_ml/1000,1)} L de objetivo.`,
      data:[`${c.waterDays.length} días con agua registrada`,'El objetivo es agua total; los alimentos aportan ~20 %'],conclusion:'Puede que te falte hidratación, sobre todo los días de entrenamiento.',
      action:{label:'Ver nutrición',tab:'nutricion',text:'Lleva una botella contigo.'},confidence:'baja'});
  }
  return out.sort((a,b)=>a.priority-b.priority);
}

if(typeof module!=='undefined')module.exports={gymWeightRate,gymInsights};
