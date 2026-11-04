const inst=d=>(S.inst[d]||[]).slice().sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));
const getI=(d,id)=>(S.inst[d]||[]).find(i=>i.id===id);
let E=null;
function clash(d,i){if(!i.time)return '';const s=mins(i.time),e=i.end?mins(i.end):s+60;const o=inst(d).find(j=>j.id!==i.id&&j.time&&s<(j.end?mins(j.end):mins(j.time)+60)&&mins(j.time)<e);return o?o.name:''}
/* Genera las tareas de cada rutina para todos los días pendientes hasta hoy (incluye días con la app cerrada). Sin duplicados: una instancia por rutina y fecha. */
function generateMonthlyObligations(){S.obligations=Array.isArray(S.obligations)?S.obligations:[];S.tx=Array.isArray(S.tx)?S.tx:[];const period=mes(hoy()),parts=period.split('-').map(Number),days=new Date(Date.UTC(parts[0],parts[1],0)).getUTCDate();S.obligations.forEach(o=>{if(!o||!o.active||!o.id||!o.name||+o.amount<=0)return;if(!Array.isArray(o.generatedMonths))o.generatedMonths=[];if(o.generatedMonths.includes(period))return;if(!S.tx.some(t=>t.obligationId===o.id&&t.obligationMonth===period)){const d=Math.min(days,Math.max(1,Math.floor(+o.day||1)));S.tx.push({id:uid(),type:'gasto',name:o.name,amount:+o.amount,date:period+'-'+String(d).padStart(2,'0'),cat:o.cat||'Otros',method:o.method||'',status:'pendiente',obligationId:o.id,obligationMonth:period})}o.generatedMonths.push(period)})}
function gen(){
  const h=hoy();
  S.routines.forEach(r=>{
    if(!r.active)return;
    let st=r.from;if(r.genTo&&r.genTo>=st)st=addDays(r.genTo,1);
    const lim=addDays(h,-400);if(st<lim)st=lim;
    for(let d=st;d<=h;d=addDays(d,1)){
      if(r.to&&d>r.to)break;
      if(!r.days.includes(dow(d)))continue;
      const L=S.inst[d]=S.inst[d]||[];
      if(L.some(i=>i.rid===r.id))continue;
      L.push({id:uid(),rid:r.id,date:d,name:r.name,time:r.time,end:r.end,cat:r.cat,note:r.notes||''});
    }
    if(!r.genTo||r.genTo<h)r.genTo=h;
  });
  generateMonthlyObligations();
  save();
}
function migrate(){
  if(!S.tasks&&!S.log)return;
  (S.tasks||[]).forEach(t=>{
    if(t.rec)S.routines.push({id:t.id,name:t.name,time:t.time||'',end:'',cat:'Personal',notes:'',days:t.days,from:t.from,to:'',active:true});
    else(S.inst[t.date]=S.inst[t.date]||[]).push({id:t.id,rid:null,date:t.date,name:t.name,time:t.time||'',end:'',cat:'Personal',note:''});
  });
  gen();
  Object.entries(S.log||{}).forEach(([d,m])=>Object.entries(m).forEach(([k,e])=>{const i=(S.inst[d]||[]).find(x=>x.id===k||x.rid===k);if(i)Object.assign(i,e)}));
  delete S.tasks;delete S.log;save();
}
function saveTask(v){
  const isR=(E&&E.t==='r')||(!E&&v.rec==='1');
  const days=DN.map((_,i)=>i).filter(i=>v['d'+i]);
  if(isR&&!days.length){alert('Elige al menos un día de la semana.');return false}
  const base={name:v.name,time:v.time||'',end:v.end||'',cat:v.cat||'Personal'},notes=v.notes||'';
  if(E&&E.t==='i'){
    const i=getI(E.d,E.id);
    if(i){Object.assign(i,base,{note:notes});
      const r=i.rid&&S.routines.find(x=>x.id===i.rid);
      if(r&&confirm('¿Aplicar este cambio también a los días futuros de la rutina?\n\nAceptar = este día y los futuros\nCancelar = solo este día'))Object.assign(r,base,{notes});}
  }else if(E&&E.t==='r'){
    const r=S.routines.find(x=>x.id===E.id);
    if(r){Object.assign(r,base,{notes,days,from:v.date||r.from,to:v.to||''});
      const i=(S.inst[hoy()]||[]).find(x=>x.rid===r.id);if(i&&!i.done)Object.assign(i,base,{note:notes});}
  }else if(isR){
    S.routines.push({id:uid(),...base,notes,days,from:v.date||hoy(),to:v.to||'',active:true});gen();
  }else{
    const d=v.date||hoy();(S.inst[d]=S.inst[d]||[]).push({id:uid(),rid:null,date:d,...base,note:notes});
  }
  E=null;
}
