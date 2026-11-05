/* ---- Gym · músculos, catálogo de ejercicios y estímulo estimado (funciones puras) ----
   Probado en tests/gym-muscles.test.mjs.

   Método (documentado y transparente):
   - Cada ejercicio tiene músculos PRINCIPALES (P) y SECUNDARIOS (S).
   - Conteo fraccional de series: una serie cuenta 1,0 para cada músculo principal y 0,5 para cada
     secundario. Es el criterio usado en la literatura sobre volumen e hipertrofia (p. ej. Pelland et
     al., 2024, meta-regresión de volumen «directo» vs «indirecto»; Schoenfeld et al., 2017).
   - Esfuerzo: si la serie tiene RPE, con RPE ≥ 7 (≈ 3 o menos repeticiones en reserva) cuenta completa;
     por debajo cuenta la mitad. Sin RPE se asume esfuerzo suficiente y se indica en la interfaz.
   - Volumen de carga por músculo = Σ peso × repeticiones × coeficiente. Es una medida de trabajo
     realizado, NO de estrés fisiológico ni de crecimiento muscular.
   - Las bandas de color usan series ponderadas por semana (referencia orientativa: ~10–20 series
     semanales por músculo es el rango que la evidencia asocia con buenos resultados). */

const GYM_MUSCLE_LIST=[
  ['pectoral_mayor','Pectoral mayor','Pecho','front'],
  ['dorsal_ancho','Dorsal ancho','Espalda','back'],['trapecio','Trapecio','Espalda','both'],['romboides','Romboides','Espalda','back'],['erectores','Erectores espinales','Espalda','back'],
  ['deltoide_anterior','Deltoides anterior','Hombros','front'],['deltoide_lateral','Deltoides lateral','Hombros','both'],['deltoide_posterior','Deltoides posterior','Hombros','back'],
  ['biceps','Bíceps braquial','Brazos','front'],['triceps','Tríceps braquial','Brazos','back'],['braquial','Braquial','Brazos','front'],['antebrazos','Antebrazos','Brazos','both'],
  ['cuadriceps','Cuádriceps','Piernas','front'],['isquiotibiales','Isquiotibiales','Piernas','back'],['gluteos','Glúteos','Piernas','back'],['gemelos','Gemelos','Piernas','back'],['soleo','Sóleo','Piernas','back'],['aductores','Aductores','Piernas','both'],
  ['recto_abdominal','Recto abdominal','Zona media','front'],['oblicuos','Oblicuos','Zona media','front']
];
const GYM_MUSCLES_BY_ID=Object.fromEntries(GYM_MUSCLE_LIST.map(([id,name,group,view])=>[id,{id,name,group,view}]));
const GYM_COEF={P:1,S:0.5};

/* Catálogo: clave estable → nombre y músculos. Las claves no cambian aunque cambie el nombre visible. */
const GYM_CATALOG=[
  ['press_banca','Press de banca','Pecho',{pectoral_mayor:'P',deltoide_anterior:'S',triceps:'S'}],
  ['press_inclinado_mancuernas','Press inclinado con mancuernas','Pecho',{pectoral_mayor:'P',deltoide_anterior:'S',triceps:'S'}],
  ['press_inclinado_barra','Press inclinado con barra','Pecho',{pectoral_mayor:'P',deltoide_anterior:'S',triceps:'S'}],
  ['aperturas_polea','Aperturas en polea','Pecho',{pectoral_mayor:'P',deltoide_anterior:'S'}],
  ['aperturas_mancuernas','Aperturas con mancuernas','Pecho',{pectoral_mayor:'P',deltoide_anterior:'S'}],
  ['flexiones','Flexiones','Pecho',{pectoral_mayor:'P',triceps:'S',deltoide_anterior:'S'}],
  ['fondos','Fondos','Tríceps',{triceps:'P',pectoral_mayor:'S',deltoide_anterior:'S'}],
  ['dominadas','Dominadas','Espalda',{dorsal_ancho:'P',biceps:'S',braquial:'S',romboides:'S',trapecio:'S',antebrazos:'S'}],
  ['jalon_pecho','Jalón al pecho','Espalda',{dorsal_ancho:'P',biceps:'S',braquial:'S',romboides:'S'}],
  ['remo_barra','Remo con barra','Espalda',{dorsal_ancho:'P',romboides:'P',trapecio:'S',deltoide_posterior:'S',biceps:'S',erectores:'S'}],
  ['remo_polea_baja','Remo en polea baja','Espalda',{dorsal_ancho:'P',romboides:'P',trapecio:'S',deltoide_posterior:'S',biceps:'S'}],
  ['remo_mancuerna','Remo con mancuerna','Espalda',{dorsal_ancho:'P',romboides:'S',deltoide_posterior:'S',biceps:'S'}],
  ['pullover_polea','Pullover en polea','Espalda',{dorsal_ancho:'P',triceps:'S'}],
  ['press_militar','Press militar','Hombros',{deltoide_anterior:'P',deltoide_lateral:'S',triceps:'S',trapecio:'S'}],
  ['elevaciones_laterales','Elevaciones laterales','Hombros',{deltoide_lateral:'P',trapecio:'S'}],
  ['elevaciones_frontales','Elevaciones frontales','Hombros',{deltoide_anterior:'P'}],
  ['pajaros','Elevaciones posteriores (pájaros)','Hombros',{deltoide_posterior:'P',romboides:'S',trapecio:'S'}],
  ['face_pull','Face pull','Hombros',{deltoide_posterior:'P',romboides:'S',trapecio:'S'}],
  ['encogimientos','Encogimientos de hombros','Espalda',{trapecio:'P'}],
  ['curl_barra','Curl con barra','Bíceps',{biceps:'P',braquial:'S',antebrazos:'S'}],
  ['curl_mancuernas','Curl con mancuernas','Bíceps',{biceps:'P',braquial:'S'}],
  ['curl_martillo','Curl martillo','Bíceps',{braquial:'P',biceps:'S',antebrazos:'S'}],
  ['curl_predicador','Curl en banco predicador','Bíceps',{biceps:'P',braquial:'S'}],
  ['extension_triceps_polea','Extensión de tríceps en polea','Tríceps',{triceps:'P'}],
  ['press_frances','Press francés','Tríceps',{triceps:'P'}],
  ['press_cerrado','Press de banca agarre cerrado','Tríceps',{triceps:'P',pectoral_mayor:'S',deltoide_anterior:'S'}],
  ['curl_muneca','Curl de muñeca','Antebrazo',{antebrazos:'P'}],
  ['sentadilla','Sentadilla','Cuádriceps',{cuadriceps:'P',gluteos:'P',aductores:'S',erectores:'S'}],
  ['sentadilla_frontal','Sentadilla frontal','Cuádriceps',{cuadriceps:'P',gluteos:'S',aductores:'S',erectores:'S'}],
  ['prensa','Prensa de piernas','Cuádriceps',{cuadriceps:'P',gluteos:'S',aductores:'S'}],
  ['extension_cuadriceps','Extensión de cuádriceps','Cuádriceps',{cuadriceps:'P'}],
  ['zancadas','Zancadas','Glúteos',{cuadriceps:'P',gluteos:'P',aductores:'S',isquiotibiales:'S'}],
  ['sentadilla_bulgara','Sentadilla búlgara','Glúteos',{cuadriceps:'P',gluteos:'P',aductores:'S'}],
  ['peso_muerto','Peso muerto','Espalda',{gluteos:'P',isquiotibiales:'P',erectores:'P',trapecio:'S',antebrazos:'S',cuadriceps:'S'}],
  ['peso_muerto_rumano','Peso muerto rumano','Femoral',{isquiotibiales:'P',gluteos:'P',erectores:'S'}],
  ['curl_femoral','Curl femoral','Femoral',{isquiotibiales:'P',gemelos:'S'}],
  ['hip_thrust','Hip thrust','Glúteos',{gluteos:'P',isquiotibiales:'S'}],
  ['abduccion_cadera','Abducción de cadera en máquina','Glúteos',{gluteos:'P'}],
  ['aduccion_cadera','Aducción de cadera en máquina','Piernas',{aductores:'P'}],
  ['hiperextensiones','Hiperextensiones','Espalda',{erectores:'P',gluteos:'S',isquiotibiales:'S'}],
  ['elevacion_talones_pie','Elevación de talones de pie','Pantorrillas',{gemelos:'P',soleo:'S'}],
  ['elevacion_talones_sentado','Elevación de talones sentado','Pantorrillas',{soleo:'P',gemelos:'S'}],
  ['plancha','Plancha','Abdomen',{recto_abdominal:'P',oblicuos:'S'}],
  ['crunch_polea','Crunch en polea','Abdomen',{recto_abdominal:'P',oblicuos:'S'}],
  ['elevacion_piernas','Elevación de piernas colgado','Abdomen',{recto_abdominal:'P',oblicuos:'S'}],
  ['pallof','Press Pallof','Abdomen',{oblicuos:'P',recto_abdominal:'S'}],
  ['russian_twist','Giros rusos','Abdomen',{oblicuos:'P',recto_abdominal:'S'}]
].map(([key,name,group,muscles])=>({key,name,group,muscles}));
const GYM_CATALOG_BY_KEY=Object.fromEntries(GYM_CATALOG.map(c=>[c.key,c]));
const gymNorm=s=>String(s||'').trim().toLocaleLowerCase('es-CO').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ');
function gymCatalogByName(name){const n=gymNorm(name);return GYM_CATALOG.find(c=>gymNorm(c.name)===n)||null}
/* Grupo antiguo (texto) → músculo principal, solo para ejercicios propios sin clasificación detallada. */
const GYM_GROUP_PRIMARY={'Pecho':'pectoral_mayor','Espalda':'dorsal_ancho','Hombros':'deltoide_lateral','Bíceps':'biceps','Tríceps':'triceps','Cuádriceps':'cuadriceps','Femoral':'isquiotibiales','Glúteos':'gluteos','Pantorrillas':'gemelos','Abdomen':'recto_abdominal','Antebrazo':'antebrazos'};
/* Músculos de un ejercicio: catálogo > clasificación guardada > grupo antiguo. Devuelve {muscleId:'P'|'S'} y su origen. */
function gymExerciseMuscles(ex){
  if(!ex)return{map:{},source:'none'};
  const cat=ex.catalog_key&&GYM_CATALOG_BY_KEY[ex.catalog_key];if(cat)return{map:cat.muscles,source:'catalog'};
  const own=ex.muscles&&typeof ex.muscles==='object'?Object.fromEntries(Object.entries(ex.muscles).filter(([m,r])=>GYM_MUSCLES_BY_ID[m]&&(r==='P'||r==='S'))):{};
  if(Object.keys(own).length)return{map:own,source:'custom'};
  /* Antes de la migración del catálogo la clasificación propia se guarda en las notas: «Músculos: id:P,id:S». */
  const m=/^Músculos: (.+)$/.exec(String(ex.notes||''));
  if(m){const fromNotes=Object.fromEntries(m[1].split(',').map(x=>x.split(':')).filter(([id,r])=>GYM_MUSCLES_BY_ID[id]&&(r==='P'||r==='S')));if(Object.keys(fromNotes).length)return{map:fromNotes,source:'custom'}}
  const byName=gymCatalogByName(ex.name);if(byName)return{map:byName.muscles,source:'catalog'};
  const g=GYM_GROUP_PRIMARY[ex.muscle];return g?{map:{[g]:'P'},source:'group'}:{map:{},source:'none'};
}
/* Factor de esfuerzo por serie (ver método arriba). */
const gymEffort=rpe=>(rpe===null||rpe===undefined||rpe==='')?1:(+rpe>=7?1:0.5);
function gymDaysAgo(today,n){const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10)}

/* Estadísticas por músculo en una ventana [from, to] (fechas de Bogotá, inclusive). */
function gymMuscleStats(sessions,sets,exercises,from,to){
  const sesById=new Map((sessions||[]).map(s=>[s.id,s])),exById=new Map((exercises||[]).map(e=>[e.id,e]));
  const musclesOf=new Map(); // la clasificación de cada ejercicio se calcula una vez, no por serie
  const dateOf=new Map();for(const x of sessions||[]){const d=gymDateOf(x.started_at);if(d>=from&&d<=to)dateOf.set(x.id,d)}
  const out={};for(const id in GYM_MUSCLES_BY_ID)out[id]={id,name:GYM_MUSCLES_BY_ID[id].name,group:GYM_MUSCLES_BY_ID[id].group,sets:0,weightedSets:0,volume:0,primarySets:0,secondarySets:0,rpeKnown:0,exercises:{},dates:new Set()};
  for(const s of sets||[]){
    const date=dateOf.get(s.session_id);if(!date)continue; // solo sesiones dentro del rango
    const ex=exById.get(s.exercise_id);let mm=musclesOf.get(s.exercise_id);if(!mm){mm=gymExerciseMuscles(ex);musclesOf.set(s.exercise_id,mm)}const {map}=mm,eff=gymEffort(s.rpe),load=(+s.weight_kg||0)*(+s.reps||0);
    for(const [m,role] of Object.entries(map)){
      const o=out[m];if(!o)continue;const c=GYM_COEF[role];
      o.sets++;o.weightedSets+=c*eff;o.volume+=load*c;if(role==='P')o.primarySets++;else o.secondarySets++;if(s.rpe!==null&&s.rpe!==undefined&&s.rpe!=='')o.rpeKnown++;o.dates.add(date);
      const k=s.exercise_id,e=o.exercises[k]||(o.exercises[k]={exercise_id:k,name:ex?.name||'Ejercicio',role,sets:0,volume:0});e.sets++;e.volume+=load*c;
    }
  }
  for(const id in out){const o=out[id];o.weightedSets=Math.round(o.weightedSets*10)/10;o.volume=Math.round(o.volume);o.sessions=o.dates.size;o.dates=[...o.dates].sort();o.exercises=Object.values(o.exercises).sort((a,b)=>b.sets-a.sets)}
  return out;
}
/* Banda de estímulo semanal a partir de series ponderadas en 7 días. */
function gymStimulusBand(weightedSetsPerWeek){const w=+weightedSetsPerWeek||0;if(w<=0)return 0;if(w<5)return 1;if(w<10)return 2;if(w<=20)return 3;return 4}
const GYM_BANDS=['Sin estímulo registrado','Bajo (menos de 5 series)','Moderado (5 a 9 series)','Productivo (10 a 20 series)','Muy alto (más de 20 series)'];

/* Tendencia de entrenamiento por músculo: últimas 4 semanas frente a las 4 anteriores.
   Indicador de constancia/carga de entrenamiento, NO una medida de crecimiento muscular. */
function gymMuscleTrend(sessions,sets,exercises,today,muscleId){
  const recent=gymMuscleStats(sessions,sets,exercises,gymDaysAgo(today,27),today)[muscleId],prev=gymMuscleStats(sessions,sets,exercises,gymDaysAgo(today,55),gymDaysAgo(today,28))[muscleId];
  /* Mejor 1RM estimado en ejercicios donde el músculo es principal, en cada ventana. */
  const sesById=new Map((sessions||[]).map(s=>[s.id,s])),exById=new Map((exercises||[]).map(e=>[e.id,e]));
  const best=(from,to)=>{const byEx={};for(const s of sets||[]){const ses=sesById.get(s.session_id);if(!ses)continue;const d=gymDateOf(ses.started_at);if(d<from||d>to)continue;const ex=exById.get(s.exercise_id);if(gymExerciseMuscles(ex).map[muscleId]!=='P')continue;const e=gymE1rm(s.weight_kg,s.reps);if(e!==null&&(!byEx[s.exercise_id]||e>byEx[s.exercise_id]))byEx[s.exercise_id]=e}return byEx};
  const bR=best(gymDaysAgo(today,27),today),bP=best(gymDaysAgo(today,55),gymDaysAgo(today,28));
  const strength=Object.keys(bR).filter(k=>bP[k]).map(k=>({exercise_id:k,name:exById.get(k)?.name||'Ejercicio',now:bR[k],before:bP[k],change:Math.round((bR[k]-bP[k])/bP[k]*1000)/10}));
  let label='Sin datos suficientes',tone='muted';
  if(recent.sets===0&&prev.sets===0)label='Sin entrenamiento registrado';
  else if(prev.sets===0)label='Empezaste a entrenarlo hace poco: aún no hay periodo anterior para comparar';
  else{const dv=(recent.weightedSets-prev.weightedSets)/prev.weightedSets,ds=strength.length?strength.reduce((a,x)=>a+x.change,0)/strength.length:null;
    if(ds!==null&&ds>=2.5){label='Progresando: tu fuerza estimada sube';tone='ok'}else if(dv>=0.15){label='Más estímulo que el mes anterior';tone='ok'}else if(dv<=-0.3){label='Menos estímulo que el mes anterior';tone='warn'}else{label='Estable';tone='muted'}}
  return{recent,prev,strength,label,tone};
}
if(typeof module!=='undefined')module.exports={GYM_MUSCLE_LIST,GYM_MUSCLES_BY_ID,GYM_CATALOG,GYM_CATALOG_BY_KEY,GYM_COEF,gymCatalogByName,gymExerciseMuscles,gymEffort,gymMuscleStats,gymStimulusBand,gymMuscleTrend,gymNorm};
