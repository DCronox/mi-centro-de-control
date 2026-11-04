/* ---- Gym Intelligence · panel nutricional (fase C): cálculos puros ----
   Suma lo registrado en un día, lo compara con el objetivo vigente ese día y resume la semana.
   Sin red ni DOM. Fechas como 'AAAA-MM-DD' en la zona de Bogotá (las da quien llama). */

const GYM_MEALS={breakfast:'Desayuno',lunch:'Almuerzo',dinner:'Cena',snack:'Snacks'};
const GYM_NUTRIENTS=[['kcal','Calorías','kcal'],['protein_g','Proteína','g'],['carbs_g','Carbohidratos','g'],['fat_g','Grasas','g'],['fiber_g','Fibra','g']];

const gnR=(x,d=1)=>{const f=10**d;return Math.round((+x||0)*f)/f};

/* Totales de un día. */
function gymDayTotals(foods,water,date){
  const t={kcal:0,protein_g:0,carbs_g:0,fat_g:0,fiber_g:0,water_ml:0,entries:0,estimated:0};
  for(const f of foods||[]){if(f.date!==date)continue;t.entries++;if(f.estimated)t.estimated++;
    for(const [k] of GYM_NUTRIENTS)t[k]+=+f[k]||0}
  for(const w of water||[])if(w.date===date)t.water_ml+=+w.ml||0;
  for(const [k] of GYM_NUTRIENTS)t[k]=gnR(t[k],k==='kcal'?0:1);
  return t;
}

/* Progreso frente a un objetivo. `ring` (0–1) nunca pasa de 1 para no deformar el círculo;
   el exceso se informa aparte. */
function gymProgress(value,target){
  const v=+value||0,t=+target||0;
  if(!(t>0))return{value:v,target:null,pct:null,ring:0,over:0,remaining:null,state:'none'};
  const pct=v/t*100;
  return{value:v,target:t,pct:Math.round(pct),ring:Math.min(1,v/t),over:Math.max(0,Math.round(pct-100)),remaining:Math.round((t-v)*10)/10,
    state:pct>110?'over':pct>=90?'ok':pct>0?'low':'empty'};
}

/* Objetivo vigente en una fecha: el último aceptado o manual creado ese día o antes
   (los «superseded» cuentan para los días en que estuvieron vigentes). */
function gymTargetFor(targets,date){
  const ok=(targets||[]).filter(t=>['accepted','manual','superseded'].includes(t.status)&&String(t.effective_from||t.created_at).slice(0,10)<=date)
    .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  return ok[0]||null;
}

function gnAddDays(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}

/* Resumen de 7 días que terminan en `today` y comparación con los 7 anteriores.
   Solo promedia los días con algún registro de comida (no inventa ceros). */
function gymWeekNutrition(foods,water,targets,today){
  const days=[];
  for(let i=6;i>=0;i--){const date=gnAddDays(today,-i),tot=gymDayTotals(foods,water,date),tg=gymTargetFor(targets,date);
    days.push({date,totals:tot,target:tg,logged:tot.entries>0,kcal:gymProgress(tot.kcal,tg?.kcal),protein:gymProgress(tot.protein_g,tg?.protein_g),water:gymProgress(tot.water_ml,tg?.water_ml)})}
  const avg=list=>{const l=list.filter(d=>d.logged);if(!l.length)return null;const s={kcal:0,protein_g:0,carbs_g:0,fat_g:0,fiber_g:0};
    l.forEach(d=>Object.keys(s).forEach(k=>s[k]+=d.totals[k]));Object.keys(s).forEach(k=>s[k]=gnR(s[k]/l.length,k==='kcal'?0:1));s.days=l.length;return s};
  const prev=[];for(let i=13;i>=7;i--){const date=gnAddDays(today,-i),tot=gymDayTotals(foods,water,date);prev.push({date,totals:tot,logged:tot.entries>0})}
  const cur=avg(days),before=avg(prev);
  const withTarget=days.filter(d=>d.logged&&d.target);
  return{days,avg:cur,prevAvg:before,
    kcalChangePct:cur&&before&&before.kcal?Math.round((cur.kcal-before.kcal)/before.kcal*100):null,
    loggedDays:days.filter(d=>d.logged).length,
    proteinHit:withTarget.filter(d=>d.protein.pct>=90).length,
    kcalInRange:withTarget.filter(d=>d.kcal.pct>=90&&d.kcal.pct<=110).length,
    withTarget:withTarget.length};
}

/* Valida una entrada manual de comida. */
function gymValidateFood(f){
  const e=[];
  if(!String(f.name||'').trim())e.push('Escribe qué comiste.');
  if(String(f.name||'').length>120)e.push('El nombre es demasiado largo.');
  if(!GYM_MEALS[f.meal])e.push('Elige la comida del día.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(f.date||''))e.push('Fecha no válida.');
  const lim={kcal:5000,protein_g:500,carbs_g:1000,fat_g:500,fiber_g:200};
  for(const [k,n] of GYM_NUTRIENTS){const v=f[k];if(v===''||v===null||v===undefined)continue;if(!(+v>=0&&+v<=lim[k]))e.push(`${n}: valor fuera de rango.`)}
  if(!(+f.kcal>0)&&!(+f.protein_g>0)&&!(+f.carbs_g>0)&&!(+f.fat_g>0))e.push('Indica al menos las calorías o algún macronutriente.');
  return e;
}
/* Si no se escriben calorías, se estiman con 4/4/9 y se marca como estimado. */
function gymFoodKcal(f){
  if(+f.kcal>0)return{kcal:+f.kcal,derived:false};
  return{kcal:Math.round((+f.protein_g||0)*4+(+f.carbs_g||0)*4+(+f.fat_g||0)*9),derived:true};
}

if(typeof module!=='undefined')module.exports={GYM_MEALS,GYM_NUTRIENTS,gymDayTotals,gymProgress,gymTargetFor,gymAddDays:gnAddDays,gymWeekNutrition,gymValidateFood,gymFoodKcal};
