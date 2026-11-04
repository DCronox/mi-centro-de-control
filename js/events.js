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
  else if(f.id==='fGoal'){const personal=v.kind==='personal',g={id:uid(),name:String(v.name).trim().slice(0,80),target:+v.target,monthly:Math.max(0,+v.monthly||0),aportes:[]};if(!(g.target>0))return;if(/^\d{4}-\d{2}-\d{2}$/.test(v.targetDate||''))g.targetDate=v.targetDate;if(personal){g.kind='personal';g.unit=String(v.unit||'').trim().slice(0,20);g.progress=[]}S.goals.push(g)}
  else if(f.classList.contains('fGoalEdit')){const g=S.goals.find(x=>x.id===f.dataset.id);if(!g||!(+v.target>0))return;g.name=String(v.name).trim().slice(0,80)||g.name;g.target=+v.target;g.monthly=Math.max(0,+v.monthly||0);if(/^\d{4}-\d{2}-\d{2}$/.test(v.targetDate||''))g.targetDate=v.targetDate;else delete g.targetDate;if(isPersonalGoal(g))g.unit=String(v.unit||'').trim().slice(0,20);window._editGoal=null}
  else if(f.id==='fBudget'){const cat=v.cat.trim(),amount=+v.amount,existing=S.budgets.find(b=>b&&String(b.cat||'').trim().toLocaleLowerCase('es-CO')===cat.toLocaleLowerCase('es-CO'));if(existing)existing.amount=amount;else S.budgets.push({id:uid(),cat,amount})}
  else if(f.classList.contains('fAp')){const g=S.goals.find(x=>x.id===f.dataset.id),n=+v.amount;if(!g||!(n>0))return;if(isPersonalGoal(g)){g.progress=Array.isArray(g.progress)?g.progress:[];g.progress.push({id:uid(),amount:n,date:hoy(),note:String(v.note||'').trim().slice(0,80)})}else{g.aportes.push({id:uid(),amount:Math.round(n),date:hoy()})}}
  else if(f.id==='fObligation'){S.obligations.push({id:uid(),name:v.name.trim(),amount:+v.amount,cat:v.cat.trim()||'Otros',day:Math.min(31,Math.max(1,+v.day||1)),active:true,generatedMonths:[]});generateMonthlyObligations()}
  else if(f.id==='fSchedule'){S.scheduledShifts.push({id:uid(),name:(v.name||'').trim(),date:v.date,in:v.in,out:v.out,brk:+v.brk||0,rate:S.rate})}
  else if(f.id==='fNotifPrefs'){const p={enabled:!!v.enabled,categories:{}};NOTIF_CATS.forEach(([k])=>p.categories[k]=!!v['cat_'+k]);['paymentLeadDays','shiftLeadMin','goalLeadDays','weeklyDay','bigExpense','savingsDay'].forEach(k=>p[k]=Math.max(0,Math.round(+v[k]||0)));p.savingsDay=Math.min(31,Math.max(1,p.savingsDay||25));['summaryTime','weeklyTime','quietStart','quietEnd'].forEach(k=>{if(/^\d{2}:\d{2}$/.test(v[k]||''))p[k]=v[k]});saveNotifPrefs(p);render();toast('Preferencias guardadas');return}
  else if(f.id==='fShift'){const r=+v.rate||S.rate;S.rate=r;S.shifts.push({id:uid(),date:v.date,in:v.in,out:v.out,brk:+v.brk||0,rate:r,paid:false,source:'manual'})}
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
  if(a==='enablePush'){enablePush();return}
  if(a==='disablePush'){disablePushHere();return}
  if(a==='testPush'){sendTestPush();return}
  if(a==='localAlerts'){enableLocalAlerts();return}
  if(a==='devRemove'){removeDevice(id);return}
  if(a==='readAll'){await markAllRead();render();return}
  if(a==='openNotif'){await markRead(id);const t=actionButton.dataset.tab;if(t&&t!=='notif'&&TABS.some(x=>x[0]===t))goTab(t);else render();return}
  if(a==='pay'){const t=S.tx.find(x=>x.id===id);if(t.type==='gasto'&&t.status==='pendiente'){const month=mes(t.date),before=monthlyCategorySpend(t.cat,month);t.status='pagado';budgetAlert=budgetThresholdMessage(t.cat,before,before+(+t.amount||0),month)}else t.status='recibido'}
  else if(a==='delTx'){if(!await ask('Se quitará de tus registros y de tus informes.',{title:'¿Eliminar este movimiento?',confirmLabel:'Eliminar',danger:true}))return;S.tx=S.tx.filter(x=>x.id!==id)}
  else if(a==='delBudget'){if(!await ask('Los movimientos de esa categoría se conservan.',{title:'¿Eliminar este presupuesto?',confirmLabel:'Eliminar',danger:true}))return;S.budgets=S.budgets.filter(x=>x.id!==id)}
  else if(a==='toggleObligation'){const o=S.obligations.find(x=>x.id===id);if(o)o.active=!o.active}
  else if(a==='delObligation'){if(!await ask('Los gastos que ya generó se conservan.',{title:'¿Eliminar esta obligación?',confirmLabel:'Eliminar',danger:true}))return;S.obligations=S.obligations.filter(x=>x.id!==id)}
  else if(a==='delScheduled'){if(!await ask('El turno se quitará de tu programación.',{title:'¿Cancelar este turno?',confirmLabel:'Cancelar turno',cancelLabel:'Mantener',danger:true}))return;S.scheduledShifts=S.scheduledShifts.filter(x=>x.id!==id)}
  else if(a==='recordScheduled'){const x=S.scheduledShifts.find(y=>y.id===id);if(!x)return;if(x.date>hoy()){toast('Aún no llega la fecha del turno.','error');return}S.shifts.push({id:uid(),date:x.date,in:x.in,out:x.out,brk:+x.brk||0,rate:+x.rate||S.rate,paid:false,source:'programado'});S.scheduledShifts=S.scheduledShifts.filter(y=>y.id!==id);budgetAlert='Turno agregado al historial.'}
  else if(a==='clockIn'){if(activeShift()){toast('Ya hay un turno en curso.','error');return}const now=Date.now();S.activeShift={on:true,date:hoy(),in:hora(),startedAt:now,rate:S.rate,u:now};if(id)S.activeShift.scheduledId=id;budgetAlert='Entrada marcada a las '+S.activeShift.in}
  else if(a==='clockOut'){const cur=activeShift();if(!cur)return;const out=hora();if(out===cur.in&&shiftElapsedHours(cur)<1/60){if(await ask('El turno duró menos de un minuto, así que no se guardará.',{title:'¿Descartar este turno?',confirmLabel:'Descartar',danger:true})){S.activeShift={on:false,u:Date.now()};save();render()}return}const brk=await askNumber('Se restan de las horas trabajadas. Escribe 0 si no tuviste descanso.',{title:'Salida a las '+out+' · ¿descanso no pago?',label:'Minutos de descanso',value:0,confirmLabel:'Guardar turno'});if(brk===null)return;S.shifts.push({id:uid(),date:cur.date,in:cur.in,out,brk,rate:+cur.rate||S.rate,paid:false,source:'reloj'});if(cur.scheduledId)S.scheduledShifts=S.scheduledShifts.filter(y=>y.id!==cur.scheduledId);S.activeShift={on:false,u:Date.now()};budgetAlert='Turno guardado: '+cur.in+'–'+out}
  else if(a==='clockCancel'){if(!await ask('No se guardará nada de este turno.',{title:'¿Descartar el turno en curso?',confirmLabel:'Descartar',danger:true}))return;S.activeShift={on:false,u:Date.now()}}
  else if(a==='delT'){if(!await ask('Solo se quita de este día. Para dejar de repetirla, edita o elimina la rutina.',{title:'¿Eliminar esta tarea?',confirmLabel:'Eliminar',danger:true}))return;S.inst[viewDay]=(S.inst[viewDay]||[]).filter(x=>x.id!==id)}
  else if(a==='go'){goTab(id);return}
  else if(a==='dayShift'){viewDay=addDays(viewDay,+id||0);render();return}
  else if(a==='dayToday'){viewDay=hoy();render();return}
  else if(a==='edI'){E={t:'i',d:viewDay,id};render();document.getElementById('taskFormCard')?.scrollIntoView({block:'start'});return}
  else if(a==='edR'){E={t:'r',id};render();document.getElementById('taskFormCard')?.scrollIntoView({block:'start'});return}
  else if(a==='canE'){E=null;render();return}
  else if(a==='togR'){const r=S.routines.find(x=>x.id===id);r.active=!r.active;if(r.active)r.genTo=addDays(hoy(),-1);gen()}
  else if(a==='delR'){if(!await ask('El historial se conserva; solo se quita la tarea pendiente de hoy.',{title:'¿Eliminar la rutina?',confirmLabel:'Eliminar',danger:true}))return;S.routines=S.routines.filter(x=>x.id!==id);S.inst[hoy()]=(S.inst[hoy()]||[]).filter(i=>!(i.rid===id&&!i.done))}
  else if(a==='delG'){const g=S.goals.find(x=>x.id===id);if(!g)return;if(!await ask(isPersonalGoal(g)?'Se borrarán la meta y sus avances.':'Sus aportes volverán a tu disponible.',{title:'¿Eliminar la meta?',confirmLabel:'Eliminar',danger:true}))return;S.goals=S.goals.filter(x=>x.id!==id)}
  else if(a==='editG'){window._editGoal=id;render();return}
  else if(a==='canEG'){window._editGoal=null;render();return}
  else if(a==='withdrawG'){const g=S.goals.find(x=>x.id===id),input=actionButton.closest('form')?.querySelector('[name=amount]'),n=Math.round(+(input?.value||0)),saved=goalModel(g).done;if(!(n>0)){toast('Escribe el valor que quieres retirar.','error');input?.focus();return}if(n>saved){await notify('En esta meta tienes '+fmt(saved)+'. No puedes retirar más que eso.',{title:'Retiro mayor al ahorrado'});return}if(!await ask(fmt(n)+' volverán a tu disponible.',{title:'¿Retirar de «'+g.name+'»?',confirmLabel:'Retirar'}))return;g.aportes.push({id:uid(),amount:-n,date:hoy()})}
  else if(a==='delAp'){const g=S.goals.find(x=>x.id===id),entry=actionButton.dataset.entry;if(!g)return;if(!await ask(isPersonalGoal(g)?'El avance se quitará del progreso de la meta.':'El valor se quitará de la meta y volverá a tu disponible.',{title:'¿Eliminar este registro?',confirmLabel:'Eliminar',danger:true}))return;if(isPersonalGoal(g))g.progress=(g.progress||[]).filter(x=>x.id!==entry);else g.aportes=g.aportes.filter(x=>x.id!==entry)}
  else if(a==='delSh'){if(!await ask('Se quitará del historial y de las horas del mes.',{title:'¿Eliminar este turno?',confirmLabel:'Eliminar',danger:true}))return;S.shifts=S.shifts.filter(x=>x.id!==id)}
  else if(a==='paySh'){const s=S.shifts.find(x=>x.id===id);if(!s)return;const n=await askAmount('Se registrará como ingreso recibido hoy, en la categoría Trabajo.',{title:'¿Cuánto recibiste por este turno?',value:Math.round(horas(s)*s.rate),confirmLabel:'Registrar pago'});if(n===null)return;s.paid=true;s.received=n;S.tx.push({id:uid(),type:'ingreso',name:'Pago de turno '+s.date,amount:n,date:hoy(),cat:'Trabajo',status:'recibido'})}
  else return;
  if(/^del/.test(a))sfx('delete');else if(a==='pay'||a==='paySh')sfx('money');
  save();render();toast(budgetAlert||'Cambios guardados');
});
app.addEventListener('change',e=>{
  if(e.target.id==='reportMonth'){window._reportMonth=e.target.value;render();return}
  if(e.target.id==='insightsMonth'){window._insightsMonth=e.target.value;render();return}
  if(e.target.id==='insightsRange'){window._insightsRange=Number(e.target.value);render();return}
  if(e.target.dataset.filter){window[e.target.dataset.filter]=e.target.value;render2();return}
  const a=e.target.dataset.a,id=e.target.dataset.id;
  if(a==='devToggle'){setDeviceEnabled(id,e.target.checked);return}
  if(a==='viewDay'){viewDay=/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)?e.target.value:hoy();render();return}
  if(a==='tgl'){const i=getI(e.target.dataset.d||viewDay,id);if(i){sfx(e.target.checked?'check':'uncheck');i.done=e.target.checked;i.real=i.done?hora():'';save();render()}}
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
document.getElementById('th').onclick=e=>{sfx('tap');animatedThemeToggle(e)};
/* Preferencia de sonidos (Cuenta › Preferencias). */
{const ps=document.getElementById('prefSound');if(ps){ps.checked=soundOn();ps.addEventListener('change',()=>{setSound(ps.checked);if(ps.checked)sfx('check')})}}
migrate();gen();
render();
openFromHash();
addEventListener('hashchange',openFromHash);
