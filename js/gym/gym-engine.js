/* ---- Gym Intelligence · motor de cálculo (funciones puras, sin red ni DOM) ----
   Estima gasto energético y objetivos nutricionales orientativos a partir de la evaluación inicial.
   Todo se calcula en el dispositivo. No es una prescripción médica: muestra rangos y supuestos.
   Referencias: js/gym/references.js (claves entre corchetes en los comentarios). */

const GYM_ENGINE_VERSION='1.0.0';

/* Opciones de la evaluación (claves estables que se guardan en la base de datos). */
const GYM_GOALS={
  fat_loss:{label:'Perder grasa'},
  muscle_gain:{label:'Ganar masa muscular'},
  recomp:{label:'Recomposición corporal'},
  strength:{label:'Ganar fuerza'},
  maintenance:{label:'Mantenerme'},
  fitness:{label:'Mejorar mi condición física'}
};
const GYM_OCCUPATIONS={
  sedentary:{label:'Sentado la mayor parte del día',pal:1.45},
  standing:{label:'De pie o caminando parte del día',pal:1.60},
  active:{label:'Trabajo físico moderado',pal:1.75},
  heavy:{label:'Trabajo físico intenso',pal:1.95}
};
const GYM_WALKING={low:{label:'Menos de 30 min al día',add:0},medium:{label:'30–60 min al día',add:0.05},high:{label:'Más de 60 min al día',add:0.10}};
const GYM_EXPERIENCE={none:{label:'Nunca he entrenado'},beginner:{label:'Menos de 1 año'},intermediate:{label:'1 a 3 años'},advanced:{label:'Más de 3 años'}};

/* Bandas de PAL de FAO/OMS/UNU 2004 [fao2004]. */
const GYM_PAL_BANDS=[
  {min:1.40,max:1.69,label:'Sedentario o ligero'},
  {min:1.70,max:1.99,label:'Activo o moderado'},
  {min:2.00,max:2.40,label:'Vigoroso'}
];

const geR10=x=>Math.round(x/10)*10;
const geR1=x=>Math.round(x*10)/10;
const geF=x=>String(x).replace(".",",");
const geClamp=(x,a,b)=>Math.min(b,Math.max(a,x));

function gymAgeFrom(birthYear,refDate){
  const y=(refDate instanceof Date?refDate:new Date(refDate||Date.now())).getFullYear();
  const b=+birthYear;return Number.isFinite(b)&&b>1900?y-b:null;
}

/* Valida la evaluación. Devuelve lista de errores legibles (vacía = válida). */
function gymValidateProfile(p,refDate){
  const e=[];const age=gymAgeFrom(p&&p.birth_year,refDate);
  if(age===null||age<10||age>100)e.push('Año de nacimiento no válido.');
  if(!['m','f','x'].includes(p&&p.sex))e.push('Elige una opción de sexo para las ecuaciones.');
  if(!(+p.height_cm>=120&&+p.height_cm<=230))e.push('La estatura debe estar entre 120 y 230 cm.');
  if(!(+p.weight_kg>=30&&+p.weight_kg<=300))e.push('El peso debe estar entre 30 y 300 kg.');
  if(!GYM_GOALS[p.goal])e.push('Elige un objetivo principal.');
  if(!GYM_OCCUPATIONS[p.occupation])e.push('Indica tu actividad diaria.');
  if(!GYM_WALKING[p.walking])e.push('Indica cuánto caminas.');
  if(!GYM_EXPERIENCE[p.experience])e.push('Indica tu experiencia entrenando.');
  const d=+p.training_days;if(!(d>=0&&d<=7))e.push('Los días de entrenamiento deben estar entre 0 y 7.');
  const m=+p.session_min;if(!(m>=0&&m<=240))e.push('La duración de la sesión debe estar entre 0 y 240 min.');
  const c=+(p.cardio_min_week||0);if(!(c>=0&&c<=1500))e.push('Los minutos de cardio por semana deben estar entre 0 y 1500.');
  return e;
}

/* Metabolismo basal (Mifflin-St Jeor) [mifflin1990] con rango ±10 % [frankenfield2005].
   Sexo 'x' (no indicado): punto medio de ambas constantes y un rango que cubre las dos. */
function gymBmr(p,age){
  const base=10*p.weight_kg+6.25*p.height_cm-5*age;
  const m=base+5,f=base-161;
  if(p.sex==='m')return{value:m,low:m*0.9,high:m*1.1};
  if(p.sex==='f')return{value:f,low:f*0.9,high:f*1.1};
  return{value:(m+f)/2,low:f*0.9,high:m*1.1};
}

/* Nivel de actividad física. Aproximación transparente dentro de las bandas de FAO/OMS/UNU:
   base por ocupación + caminata + horas semanales de entrenamiento y cardio. No usa valores MET concretos. */
function gymPal(p){
  const base=GYM_OCCUPATIONS[p.occupation].pal;
  const walk=GYM_WALKING[p.walking].add;
  const trainH=(+p.training_days||0)*(+p.session_min||0)/60;
  const cardioH=(+p.cardio_min_week||0)/60;
  const train=Math.min(0.20,trainH*0.025),cardio=Math.min(0.25,cardioH*0.05);
  const value=geClamp(base+walk+train+cardio,1.40,2.40);
  const band=GYM_PAL_BANDS.find(b=>value>=b.min&&value<=b.max+0.005)||GYM_PAL_BANDS[0];
  return{value:Math.round(value*100)/100,low:Math.round(Math.max(1.40,value-0.10)*100)/100,high:Math.round(Math.min(2.40,value+0.10)*100)/100,band:band.label,parts:{base,walk,train:geR1(train*100)/100,cardio:geR1(cardio*100)/100,trainH:geR1(trainH),cardioH:geR1(cardioH)}};
}

/* Modo de seguridad: decide si se calculan objetivos y con qué límites. */
function gymSafetyMode(p,age){
  const s=p.safety||{};const reasons=[];
  if(age!==null&&age<18)return{mode:'minor',reasons:['Eres menor de 18 años: las ecuaciones de adultos no aplican y no se fijan objetivos de calorías.']};
  if(s.pregnant)reasons.push('Embarazo: las necesidades cambian por trimestre.');
  if(s.lactating)reasons.push('Lactancia: las necesidades de energía y agua son mayores.');
  if(s.eating_disorder)reasons.push('Antecedente de trastorno de la conducta alimentaria.');
  if(reasons.length)return{mode:'professional',reasons};
  if(s.condition)reasons.push('Has declarado una condición de salud relevante.');
  if(s.medication)reasons.push('Tomas medicación que puede influir en el peso o el apetito.');
  if(reasons.length)return{mode:'prudent',reasons};
  return{mode:'standard',reasons:[]};
}

/* Calcula el objetivo completo. Devuelve también los pasos del cálculo, supuestos y avisos. */
function gymComputeTargets(p,refDate){
  const errors=gymValidateProfile(p,refDate);
  if(errors.length)return{ok:false,errors};
  const age=gymAgeFrom(p.birth_year,refDate);
  const w=+p.weight_kg,h=+p.height_cm,hm=h/100,bmi=w/(hm*hm);
  const safety=gymSafetyMode(p,age);
  const steps=[],warnings=[],refs=new Set();
  const out={ok:true,version:GYM_ENGINE_VERSION,age,bmi:geR1(bmi),safety,steps,warnings,refs:[]};
  steps.push({label:'Índice de masa corporal',value:geR1(bmi),detail:`${geF(w)} kg ÷ (${geF(hm.toFixed(2))} m)²`});

  /* Agua y fibra de referencia (adultos). */
  const waterL=p.sex==='f'?2.0:p.sex==='m'?2.5:2.25;

  if(safety.mode==='minor'||safety.mode==='professional'){
    warnings.push(...safety.reasons);
    warnings.push('Te recomendamos que un profesional de la salud o de la nutrición defina tus objetivos. Puedes seguir registrando entrenos, comidas y descanso.');
    out.energy=null;out.macros=null;
    out.water={liters:safety.mode==='minor'?null:waterL,note:'Referencia general de agua total (bebidas y alimentos) para adultos; puede ser mayor en tu caso.'};
    if(safety.mode!=='minor')refs.add('efsa2010water');
    out.refs=[...refs];return out;
  }

  /* 1. Basal */
  const bmr=gymBmr(p,age);refs.add('mifflin1990').add('frankenfield2005');
  steps.push({label:'Metabolismo basal estimado',value:Math.round(bmr.value),unit:'kcal',range:[Math.round(bmr.low),Math.round(bmr.high)],detail:`Mifflin-St Jeor: 10×peso + 6,25×estatura − 5×edad ${p.sex==='m'?'+ 5':p.sex==='f'?'− 161':'(constante intermedia)'}`,ref:'mifflin1990'});
  if(age>78)warnings.push('La ecuación se desarrolló con personas de 19 a 78 años; a tu edad la estimación es menos precisa.');
  if(p.sex==='x')warnings.push('Sin sexo indicado se usa un valor intermedio y el rango es más amplio.');
  if(bmi>=30)warnings.push('Con IMC alto las ecuaciones pueden sobrestimar o subestimar más; la revisión con tu peso real corregirá el objetivo.');

  /* 2. Actividad y gasto total */
  const pal=gymPal(p);refs.add('fao2004');
  steps.push({label:'Nivel de actividad física (PAL)',value:pal.value,range:[geR1(pal.low*100)/100,geR1(pal.high*100)/100],detail:`${pal.band}. Base por actividad diaria ${geF(pal.parts.base)} + caminata ${geF(pal.parts.walk)} + entrenamiento (${geF(pal.parts.trainH)} h/sem) ${geF(pal.parts.train)} + cardio (${geF(pal.parts.cardioH)} h/sem) ${geF(pal.parts.cardio)}. Aproximación propia dentro de las bandas de FAO/OMS/UNU.`,ref:'fao2004'});
  const tdee=bmr.value*pal.value,tdeeLow=bmr.low*pal.low,tdeeHigh=bmr.high*pal.high;
  steps.push({label:'Gasto diario estimado (mantenimiento)',value:geR10(tdee),unit:'kcal',range:[geR10(tdeeLow),geR10(tdeeHigh)],detail:'Basal × PAL. El rango combina la incertidumbre del basal y de la actividad.'});

  /* 3. Ajuste por objetivo */
  let kcal=tdee,adjust=0,adjustNote='Objetivo en torno al mantenimiento.',weeklyKg=null;
  const goal=safety.mode==='prudent'?'maintenance':p.goal;
  if(safety.mode==='prudent'){warnings.push(...safety.reasons);warnings.push('Modo prudente: solo se propone mantenimiento orientativo. Consulta a un profesional antes de buscar déficit o superávit.');}
  if(goal==='fat_loss'){
    refs.add('helms2014').add('roberts2020');
    if(bmi<18.5){adjustNote='Tu IMC está por debajo de 18,5: no se propone déficit. Considera consultar a un profesional.';warnings.push(adjustNote);}
    else{
      weeklyKg=w*0.005; // ~0,5 % del peso por semana
      let deficit=weeklyKg*7700/7; // aproximación clásica de ~7.700 kcal por kg de tejido; la revisión con datos reales la corrige
      const cap=tdee*0.20;
      if(deficit>cap){deficit=cap;weeklyKg=deficit*7/7700;}
      if(tdee-deficit<bmr.value){deficit=Math.max(0,tdee-bmr.value);weeklyKg=deficit*7/7700;warnings.push('El déficit se limitó para no quedar por debajo de tu basal estimado.');}
      adjust=-deficit;adjustNote=`Déficit prudente para perder alrededor de ${geF(Math.round(weeklyKg*100)/100)} kg/semana (~${geF(geR1(weeklyKg/w*1000)/10)} % del peso). Tope: 20 % del gasto y nunca por debajo del basal. Usa la aproximación clásica de ~7.700 kcal por kg; la revisión con tu peso real la corrige.`;
    }
  }else if(goal==='muscle_gain'){
    refs.add('iraki2019');
    const pct=p.experience==='advanced'?0.05:0.10;
    adjust=tdee*pct;weeklyKg=w*(p.experience==='advanced'?0.0025:0.0035);
    adjustNote=`Superávit pequeño del ${pct*100} % para limitar la ganancia de grasa. Ritmo orientativo: ~${geF(Math.round(weeklyKg*100)/100)} kg/semana.`;
    if(bmi>=30)warnings.push('Con IMC alto, muchas personas obtienen buenos resultados con recomposición (mantenimiento). Puedes cambiar el objetivo cuando quieras.');
  }
  kcal=tdee+adjust;
  steps.push({label:'Ajuste por objetivo',value:Math.round(adjust),unit:'kcal',detail:adjustNote});
  const kcalT=geR10(kcal);

  /* 4. Proteína */
  refs.add('morton2018').add('jager2017');
  const refW=bmi>=30?25*hm*hm:w;
  let gkg=1.6;
  if(goal==='fat_loss'&&bmi>=18.5)gkg=(p.experience==='intermediate'||p.experience==='advanced')?2.0:1.8;
  const protein=Math.round(refW*gkg);
  steps.push({label:'Proteína',value:protein,unit:'g',range:[Math.round(refW*1.4),Math.round(refW*2.2)],detail:`${geF(gkg)} g por kg de ${bmi>=30?'peso de referencia (IMC 25 para tu estatura, '+geF(geR1(refW))+' kg)':'peso'}. Rango útil 1,4–2,2 g/kg.`,ref:gkg>1.6?'jager2017':'morton2018'});

  /* 5. Grasa y carbohidratos */
  refs.add('iomFiber').add('thomas2016');
  let fatPct=0.25,fat=Math.round(kcalT*fatPct/9);
  let carbs=Math.round((kcalT-protein*4-fat*9)/4);
  if(carbs<0){fatPct=0.20;fat=Math.round(kcalT*fatPct/9);carbs=Math.max(0,Math.round((kcalT-protein*4-fat*9)/4));}
  steps.push({label:'Grasa',value:fat,unit:'g',detail:`${Math.round(fatPct*100)} % de la energía (rango recomendado 20–35 %).`,ref:'iomFiber'});
  steps.push({label:'Carbohidratos',value:carbs,unit:'g',detail:`El resto de la energía (${geF(geR1(carbs/w*10)/10)} g/kg).`,ref:'thomas2016'});
  if((+p.training_days||0)>=3&&carbs/w<3)warnings.push('Tus carbohidratos quedan por debajo de 3 g/kg, lo habitual para entrenamiento moderado. Puede afectar al rendimiento.');

  /* 6. Fibra y agua */
  const fiber=Math.round(kcalT*14/1000);
  steps.push({label:'Fibra',value:fiber,unit:'g',detail:'14 g por cada 1.000 kcal.',ref:'iomFiber'});
  refs.add('efsa2010water');

  /* 7. Coherencia */
  const fromMacros=protein*4+carbs*4+fat*9;
  const diff=Math.abs(fromMacros-kcalT)/kcalT;
  if(diff>0.02)warnings.push(`Las calorías de los macronutrientes (${fromMacros}) difieren de tu objetivo (${kcalT}).`);

  out.energy={bmr:Math.round(bmr.value),bmrRange:[Math.round(bmr.low),Math.round(bmr.high)],pal:pal.value,palBand:pal.band,tdee:geR10(tdee),tdeeRange:[geR10(tdeeLow),geR10(tdeeHigh)],kcal:kcalT,kcalRange:[geR10(tdeeLow+adjust),geR10(tdeeHigh+adjust)],adjust:Math.round(adjust),weeklyKg:weeklyKg===null?null:Math.round(weeklyKg*100)/100,goal};
  out.macros={protein,carbs,fat,fiber,proteinPerKg:gkg,fatPct:Math.round(fatPct*100),kcalFromMacros:fromMacros};
  out.water={liters:waterL,note:'Agua total diaria (bebidas y alimentos, ~80 % bebida). Aumenta con calor y entrenamiento.'};
  out.refs=[...refs];
  return out;
}

/* Diferencia relativa entre dos objetivos de kcal (para pedir confirmación si supera ~5 %). */
function gymTargetChange(prevKcal,nextKcal){
  if(!prevKcal||!nextKcal)return null;
  return Math.round((nextKcal-prevKcal)/prevKcal*1000)/10;
}

if(typeof module!=='undefined')module.exports={GYM_ENGINE_VERSION,GYM_GOALS,GYM_OCCUPATIONS,GYM_WALKING,GYM_EXPERIENCE,GYM_PAL_BANDS,gymAgeFrom,gymValidateProfile,gymBmr,gymPal,gymSafetyMode,gymComputeTargets,gymTargetChange};
