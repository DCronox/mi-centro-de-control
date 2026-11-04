const app=document.getElementById('app');
app.addEventListener('submit',e=>{
  e.preventDefault();const f=e.target,v=Object.fromEntries(new FormData(f));let budgetAlert='';
  if(f.id==='fTx'){const cat=v.cat.trim(),status=v.status==='pendiente'?'pendiente':(v.type==='ingreso'?'recibido':'pagado'),month=mes(v.date);if(v.type==='gasto'&&status==='pagado'){const before=monthlyCategorySpend(cat,month);budgetAlert=budgetThresholdMessage(cat,before,before+(+v.amount||0),month)}S.tx.push({id:uid(),type:v.type,name:v.name,amount:+v.amount,date:v.date,cat,method:v.method||'',status})}
  else if(f.id==='fTask'){if(saveTask(v)===false)return}
  else if(f.id==='fGoal'){S.goals.push({id:uid(),name:v.name,target:+v.target,monthly:+v.monthly||0,aportes:[]})}
  else if(f.id==='fBudget'){const cat=v.cat.trim(),amount=+v.amount,existing=S.budgets.find(b=>b&&String(b.cat||'').trim().toLocaleLowerCase('es-CO')===cat.toLocaleLowerCase('es-CO'));if(existing)existing.amount=amount;else S.budgets.push({id:uid(),cat,amount})}
  else if(f.classList.contains('fAp')){const g=S.goals.find(x=>x.id===f.dataset.id);g.aportes.push({amount:+v.amount,date:hoy()})}
  else if(f.id==='fObligation'){S.obligations.push({id:uid(),name:v.name.trim(),amount:+v.amount,cat:v.cat.trim()||'Otros',day:Math.min(31,Math.max(1,+v.day||1)),active:true,generatedMonths:[]});generateMonthlyObligations()}
  else if(f.id==='fSchedule'){S.scheduledShifts.push({id:uid(),name:(v.name||'').trim(),date:v.date,in:v.in,out:v.out,brk:+v.brk||0,rate:S.rate})}
  else if(f.id==='fShift'){const r=+v.rate||S.rate;S.rate=r;S.shifts.push({id:uid(),date:v.date,in:v.in,out:v.out,brk:+v.brk||0,rate:r,paid:false})}
  else return;
  save();render();toast(budgetAlert||'Cambios guardados');
});
app.addEventListener('click',e=>{
  const actionButton=e.target.closest('[data-a]'),a=actionButton?.dataset.a,id=actionButton?.dataset.id;if(!a)return;let budgetAlert='';
  if(a==='clearMoveFilters'){window._q='';window._f='todos';window._moveStatus='todos';window._moveCategory='todos';window._moveFrom='';window._moveTo='';render();return}
  if(a==='insightCategory'){window._q='';window._f='gasto';window._moveStatus='todos';window._moveCategory=id;window._moveFrom=(window._insightsMonth||mes(hoy()))+'-01';window._moveTo=addDays(monthShift(window._insightsMonth||mes(hoy()),1)+'-01',-1);tab='mov';render();scrollTo(0,0);return}
  if(a==='exportReport'){exportReportCsv();return}
  if(a==='printReport'){window.print();return}
  if(a==='pay'){const t=S.tx.find(x=>x.id===id);if(t.type==='gasto'&&t.status==='pendiente'){const month=mes(t.date),before=monthlyCategorySpend(t.cat,month);t.status='pagado';budgetAlert=budgetThresholdMessage(t.cat,before,before+(+t.amount||0),month)}else t.status='recibido'}
  else if(a==='delTx'){if(!confirm('¿Eliminar este movimiento?'))return;S.tx=S.tx.filter(x=>x.id!==id)}
  else if(a==='delBudget'){if(!confirm('¿Eliminar este presupuesto? Los movimientos se conservarán.'))return;S.budgets=S.budgets.filter(x=>x.id!==id)}
  else if(a==='toggleObligation'){const o=S.obligations.find(x=>x.id===id);if(o)o.active=!o.active}
  else if(a==='delObligation'){if(!confirm('¿Eliminar la regla? Los gastos ya creados se conservan.'))return;S.obligations=S.obligations.filter(x=>x.id!==id)}
  else if(a==='delScheduled'){if(!confirm('¿Cancelar este turno programado?'))return;S.scheduledShifts=S.scheduledShifts.filter(x=>x.id!==id)}
  else if(a==='recordScheduled'){const x=S.scheduledShifts.find(y=>y.id===id);if(!x)return;if(x.date>hoy()){toast('Aún no llega la fecha del turno.');return}S.shifts.push({id:uid(),date:x.date,in:x.in,out:x.out,brk:+x.brk||0,rate:+x.rate||S.rate,paid:false});S.scheduledShifts=S.scheduledShifts.filter(y=>y.id!==id);budgetAlert='Turno agregado al historial.'}
  else if(a==='delT'){if(!confirm('¿Eliminar esta tarea solo de este día? Para dejar de repetirla, edita o elimina la rutina.'))return;S.inst[viewDay]=(S.inst[viewDay]||[]).filter(x=>x.id!==id)}
  else if(a==='go'){tab=id;render();scrollTo(0,0);return}
  else if(a==='edI'){E={t:'i',d:viewDay,id};render();scrollTo(0,0);return}
  else if(a==='edR'){E={t:'r',id};render();scrollTo(0,0);return}
  else if(a==='canE'){E=null;render();return}
  else if(a==='togR'){const r=S.routines.find(x=>x.id===id);r.active=!r.active;if(r.active)r.genTo=addDays(hoy(),-1);gen()}
  else if(a==='delR'){if(!confirm('¿Eliminar la rutina? El historial anterior se conserva; solo se quita la tarea pendiente de hoy.'))return;S.routines=S.routines.filter(x=>x.id!==id);S.inst[hoy()]=(S.inst[hoy()]||[]).filter(i=>!(i.rid===id&&!i.done))}
  else if(a==='delG'){if(!confirm('¿Eliminar la meta? Sus aportes volverán a tu disponible.'))return;S.goals=S.goals.filter(x=>x.id!==id)}
  else if(a==='delSh'){if(!confirm('¿Eliminar este turno?'))return;S.shifts=S.shifts.filter(x=>x.id!==id)}
  else if(a==='paySh'){const s=S.shifts.find(x=>x.id===id),v=prompt('¿Cuánto recibiste realmente (COP)?',Math.round(horas(s)*s.rate));if(v===null)return;const n=+String(v).replace(/\D/g,'');s.paid=true;s.received=n;S.tx.push({id:uid(),type:'ingreso',name:'Pago de turno '+s.date,amount:n,date:hoy(),cat:'Trabajo',status:'recibido'})}
  else return;
  save();render();toast(budgetAlert||'Cambios guardados');
});
app.addEventListener('change',e=>{
  if(e.target.id==='reportMonth'){window._reportMonth=e.target.value;render();return}
  if(e.target.id==='insightsMonth'){window._insightsMonth=e.target.value;render();return}
  if(e.target.id==='insightsRange'){window._insightsRange=Number(e.target.value);render();return}
  const a=e.target.dataset.a,id=e.target.dataset.id;
  if(a==='tgl'){const i=getI(e.target.dataset.d||viewDay,id);if(i){i.done=e.target.checked;i.real=i.done?hora():'';save();render()}}
  else if(a==='note'){const i=getI(viewDay,id);if(i){i.note=e.target.value;save()}}
});

/* ---- cambio de día automático ---- */
function check(){gen();const h=hoy();if(h!==day){if(viewDay===day)viewDay=h;day=h}render()}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
window.addEventListener('focus',check);
setInterval(()=>{if(!app.contains(document.activeElement)||document.activeElement.tagName==='BODY')check();else{document.getElementById('fecha').textContent=fechaLarga(hoy())+' · '+hora();if(hoy()!==day)check()}},30000);
document.getElementById('th').innerHTML=ico('moon',15)+' Tema';
document.getElementById('th').onclick=()=>{const r=document.documentElement,n=r.dataset.theme==='light'?'dark':'light';r.dataset.theme=n;syncBrowserThemeColor();try{localStorage.setItem('mcc-theme',n)}catch(e){}};
migrate();gen();
render();
