const app=document.getElementById('app');
/* Registra un ingreso o gasto. Devuelve el aviso de presupuesto, si lo hay. */
function addTransaction(v){
  const cat=String(v.cat||'').trim()||'Otros',amount=Math.round(+v.amount),type=v.type==='ingreso'?'ingreso':'gasto',date=/^\d{4}-\d{2}-\d{2}$/.test(v.date)?v.date:hoy(),status=v.status==='pendiente'?'pendiente':(type==='ingreso'?'recibido':'pagado'),month=mes(date);
  if(!(amount>0))return '';
  let budgetAlert='';
  if(type==='gasto'&&status==='pagado'){const before=monthlyCategorySpend(cat,month);budgetAlert=budgetThresholdMessage(cat,before,before+amount,month)}
  S.tx.push({id:uid(),type,name:String(v.name||'').trim().slice(0,120),amount,date,cat,method:v.method||'',status});
  return budgetAlert;
}
app.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target,v=Object.fromEntries(new FormData(f));let budgetAlert='';
  if(f.id==='fTx'){budgetAlert=addTransaction(v)}
  else if(f.id==='fTask'){if(await saveTask(v)===false)return}
  else if(f.id==='fGoal'){S.goals.push({id:uid(),name:v.name,target:+v.target,monthly:+v.monthly||0,aportes:[]})}
  else if(f.id==='fBudget'){const cat=v.cat.trim(),amount=+v.amount,existing=S.budgets.find(b=>b&&String(b.cat||'').trim().toLocaleLowerCase('es-CO')===cat.toLocaleLowerCase('es-CO'));if(existing)existing.amount=amount;else S.budgets.push({id:uid(),cat,amount})}
  else if(f.classList.contains('fAp')){const g=S.goals.find(x=>x.id===f.dataset.id);g.aportes.push({id:uid(),amount:+v.amount,date:hoy()})}
  else if(f.id==='fObligation'){S.obligations.push({id:uid(),name:v.name.trim(),amount:+v.amount,cat:v.cat.trim()||'Otros',day:Math.min(31,Math.max(1,+v.day||1)),active:true,generatedMonths:[]});generateMonthlyObligations()}
  else if(f.id==='fSchedule'){S.scheduledShifts.push({id:uid(),name:(v.name||'').trim(),date:v.date,in:v.in,out:v.out,brk:+v.brk||0,rate:S.rate})}
  else if(f.id==='fShift'){const r=+v.rate||S.rate;S.rate=r;S.shifts.push({id:uid(),date:v.date,in:v.in,out:v.out,brk:+v.brk||0,rate:r,paid:false})}
  else return;
  save();render();toast(budgetAlert||'Cambios guardados');
});
app.addEventListener('click',async e=>{
  const actionButton=e.target.closest('[data-a]'),a=actionButton?.dataset.a,id=actionButton?.dataset.id;if(!a)return;let budgetAlert='';
  if(a==='clearMoveFilters'){window._q='';window._f='todos';window._moveStatus='todos';window._moveCategory='todos';window._moveFrom='';window._moveTo='';render();return}
  if(a==='insightCategory'){window._q='';window._f='gasto';window._moveStatus='todos';window._moveCategory=id;window._moveFrom=(window._insightsMonth||mes(hoy()))+'-01';window._moveTo=addDays(monthShift(window._insightsMonth||mes(hoy()),1)+'-01',-1);goTab('mov');return}
  if(a==='exportReport'){exportReportCsv();return}
  if(a==='printReport'){window.print();return}
  if(a==='reportView'){window._reportView=id;render();return}
  if(a==='pay'){const t=S.tx.find(x=>x.id===id);if(t.type==='gasto'&&t.status==='pendiente'){const month=mes(t.date),before=monthlyCategorySpend(t.cat,month);t.status='pagado';budgetAlert=budgetThresholdMessage(t.cat,before,before+(+t.amount||0),month)}else t.status='recibido'}
  else if(a==='delTx'){if(!await ask('Se quitará de tus registros y de tus informes.',{title:'¿Eliminar este movimiento?',confirmLabel:'Eliminar',danger:true}))return;S.tx=S.tx.filter(x=>x.id!==id)}
  else if(a==='delBudget'){if(!await ask('Los movimientos de esa categoría se conservan.',{title:'¿Eliminar este presupuesto?',confirmLabel:'Eliminar',danger:true}))return;S.budgets=S.budgets.filter(x=>x.id!==id)}
  else if(a==='toggleObligation'){const o=S.obligations.find(x=>x.id===id);if(o)o.active=!o.active}
  else if(a==='delObligation'){if(!await ask('Los gastos que ya generó se conservan.',{title:'¿Eliminar esta obligación?',confirmLabel:'Eliminar',danger:true}))return;S.obligations=S.obligations.filter(x=>x.id!==id)}
  else if(a==='delScheduled'){if(!await ask('El turno se quitará de tu programación.',{title:'¿Cancelar este turno?',confirmLabel:'Cancelar turno',cancelLabel:'Mantener',danger:true}))return;S.scheduledShifts=S.scheduledShifts.filter(x=>x.id!==id)}
  else if(a==='recordScheduled'){const x=S.scheduledShifts.find(y=>y.id===id);if(!x)return;if(x.date>hoy()){toast('Aún no llega la fecha del turno.');return}S.shifts.push({id:uid(),date:x.date,in:x.in,out:x.out,brk:+x.brk||0,rate:+x.rate||S.rate,paid:false});S.scheduledShifts=S.scheduledShifts.filter(y=>y.id!==id);budgetAlert='Turno agregado al historial.'}
  else if(a==='delT'){if(!await ask('Solo se quita de este día. Para dejar de repetirla, edita o elimina la rutina.',{title:'¿Eliminar esta tarea?',confirmLabel:'Eliminar',danger:true}))return;S.inst[viewDay]=(S.inst[viewDay]||[]).filter(x=>x.id!==id)}
  else if(a==='go'){goTab(id);return}
  else if(a==='edI'){E={t:'i',d:viewDay,id};render();scrollTo(0,0);return}
  else if(a==='edR'){E={t:'r',id};render();scrollTo(0,0);return}
  else if(a==='canE'){E=null;render();return}
  else if(a==='togR'){const r=S.routines.find(x=>x.id===id);r.active=!r.active;if(r.active)r.genTo=addDays(hoy(),-1);gen()}
  else if(a==='delR'){if(!await ask('El historial se conserva; solo se quita la tarea pendiente de hoy.',{title:'¿Eliminar la rutina?',confirmLabel:'Eliminar',danger:true}))return;S.routines=S.routines.filter(x=>x.id!==id);S.inst[hoy()]=(S.inst[hoy()]||[]).filter(i=>!(i.rid===id&&!i.done))}
  else if(a==='delG'){if(!await ask('Sus aportes volverán a tu disponible.',{title:'¿Eliminar la meta?',confirmLabel:'Eliminar',danger:true}))return;S.goals=S.goals.filter(x=>x.id!==id)}
  else if(a==='delSh'){if(!await ask('Se quitará del historial y de las horas del mes.',{title:'¿Eliminar este turno?',confirmLabel:'Eliminar',danger:true}))return;S.shifts=S.shifts.filter(x=>x.id!==id)}
  else if(a==='paySh'){const s=S.shifts.find(x=>x.id===id);if(!s)return;const n=await askAmount('Se registrará como ingreso recibido hoy, en la categoría Trabajo.',{title:'¿Cuánto recibiste por este turno?',value:Math.round(horas(s)*s.rate),confirmLabel:'Registrar pago'});if(n===null)return;s.paid=true;s.received=n;S.tx.push({id:uid(),type:'ingreso',name:'Pago de turno '+s.date,amount:n,date:hoy(),cat:'Trabajo',status:'recibido'})}
  else return;
  save();render();toast(budgetAlert||'Cambios guardados');
});
app.addEventListener('change',e=>{
  if(e.target.id==='reportMonth'){window._reportMonth=e.target.value;render();return}
  if(e.target.id==='insightsMonth'){window._insightsMonth=e.target.value;render();return}
  if(e.target.id==='insightsRange'){window._insightsRange=Number(e.target.value);render();return}
  if(e.target.dataset.filter){window[e.target.dataset.filter]=e.target.value;render2();return}
  const a=e.target.dataset.a,id=e.target.dataset.id;
  if(a==='viewDay'){viewDay=/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)?e.target.value:hoy();render();return}
  if(a==='tgl'){const i=getI(e.target.dataset.d||viewDay,id);if(i){i.done=e.target.checked;i.real=i.done?hora():'';save();render()}}
  else if(a==='note'){const i=getI(viewDay,id);if(i){i.note=e.target.value;save()}}
});
/* Búsqueda de movimientos: actualiza solo los resultados mientras se escribe. */
app.addEventListener('input',e=>{if(e.target.dataset.filter==='_q'){window._q=e.target.value;render2()}});

/* ---- cambio de día automático ---- */
function check(){gen();const h=hoy();if(h!==day){if(viewDay===day)viewDay=h;day=h}render()}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
window.addEventListener('focus',check);
setInterval(()=>{if(!app.contains(document.activeElement)||document.activeElement.tagName==='BODY')check();else{document.getElementById('fecha').textContent=fechaLarga(hoy());if(hoy()!==day)check()}},30000);
document.getElementById('th').innerHTML=ico('moon',16)+'<span>Cambiar tema</span>';
document.getElementById('th').onclick=toggleTheme;
migrate();gen();
render();
