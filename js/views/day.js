/* ---- Mi día: agenda del día (tareas, turnos y pagos), tareas y rutinas, historial ----
   Campo nuevo opcional en tareas y rutinas: remind = minutos de anticipación ('' = sin recordatorio).
   Los recordatorios se muestran aquí y en Inicio; el aviso en el celular llega con las notificaciones. */
const REMIND_OPTS=[['','Sin recordatorio'],['0','A la hora de inicio'],['10','10 min antes'],['30','30 min antes'],['60','1 hora antes'],['120','2 horas antes']];
const remindLabel=v=>(REMIND_OPTS.find(o=>o[0]===String(v??''))||REMIND_OPTS[0])[1];
function nowMinutes(){const[a,b]=hora().split(':').map(Number);return a*60+b}
/* Próxima tarea pendiente de hoy con hora, para el aviso de la agenda. */
function nextTaskToday(){const h=hoy(),n=nowMinutes();return inst(h).filter(t=>!t.done&&t.time&&mins(t.time)>=n).sort((a,b)=>a.time.localeCompare(b.time))[0]||null}
function agendaItems(d){
  const h=hoy();
  let ts=inst(d);
  if(d>h)ts=ts.concat(S.routines.filter(r=>r.active&&r.days.includes(dow(d))&&d>=r.from&&(!r.to||d<=r.to)&&!ts.some(t=>t.rid===r.id)).map(r=>({id:r.id,rid:r.id,name:r.name,time:r.time,end:r.end,cat:r.cat,remind:r.remind,preview:true})));
  const items=ts.map(t=>({kind:'task',time:t.time||'',t}));
  (S.scheduledShifts||[]).filter(x=>x&&x.date===d).forEach(x=>items.push({kind:'shift',time:x.in||'',x,planned:true}));
  S.shifts.filter(x=>x.date===d).forEach(x=>items.push({kind:'shift',time:x.in||'',x,planned:false}));
  S.tx.filter(t=>t.type==='gasto'&&t.status==='pendiente'&&t.date===d).forEach(t=>items.push({kind:'pay',time:'',t}));
  return items.sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
}
function agendaRow(it,d){
  if(it.kind==='shift'){const x=it.x;return `<div class="row agenda-row"><span class="agenda-time">${esc(x.in)}</span><span class="ti">${ico('clock',16)}</span><div class="g1"><b>${it.planned?'Turno programado':'Turno realizado'}</b><small>${esc(x.in)}–${esc(x.out)} · ${horas(x).toFixed(1)} h · ${fmt(shiftPay(x))}${it.planned?' estimados':''}</small></div><button class="lk" type="button" data-a="go" data-id="turnos">Turnos</button></div>`}
  if(it.kind==='pay'){const t=it.t;return `<div class="row agenda-row"><span class="agenda-time">—</span><span class="ti ti-bad">${ico('wallet',16)}</span><div class="g1"><b>Pagar: ${esc(t.name)}</b><small>${esc(t.cat||'Otros')}</small></div><b class="amt">${fmt(t.amount)}</b><button class="g" type="button" data-a="pay" data-id="${esc(t.id)}">Pagado</button></div>`}
  const t=it.t,c=t.preview?'':clash(d,t);
  return `<div class="row agenda-row ${t.done?'done':''}"><span class="agenda-time">${esc(t.time||'—')}</span>${t.preview?'<span class="tag">Prog.</span>':`<input type="checkbox" ${t.done?'checked':''} data-a="tgl" data-id="${esc(t.id)}" aria-label="Marcar ${esc(t.name)} como completada">`}
  <div class="g1"><span class="t">${esc(t.name)}</span> ${t.rid?'<span class="tag">Rutina</span>':''} ${t.cat?`<span class="tag">${esc(t.cat)}</span>`:''}<small>${t.time?esc(t.time)+(t.end?'–'+esc(t.end):''):'Sin hora'}${t.remind!==undefined&&t.remind!==''&&t.time?' · '+esc(remindLabel(t.remind)):''}${t.real?' · hecha a las '+esc(t.real):''}${c?` · <span class="warn">Se cruza con ${esc(c)}</span>`:''}</small>
  ${t.preview?'':`<input class="note-input" placeholder="Notas del día" aria-label="Notas para ${esc(t.name)}" value="${esc(t.note||'')}" data-a="note" data-id="${esc(t.id)}">`}</div>
  ${t.preview?'':`<button class="g ic-b" type="button" data-a="edI" data-id="${esc(t.id)}" aria-label="Editar ${esc(t.name)}">${ico('edit',15)}</button><button class="g ic-b" type="button" data-a="delT" data-id="${esc(t.id)}" aria-label="Eliminar ${esc(t.name)} de este día">${ico('x',15)}</button>`}</div>`;
}
function vDia(){
  const d=viewDay,h=hoy();
  let dv={name:'',time:'',end:'',cat:'',notes:'',date:d,to:'',days:[1,2,3,4,5],rec:'0',remind:''};
  if(E&&E.t==='i'){const i=getI(E.d,E.id);if(i)dv={...dv,...i,notes:i.note||''}}
  if(E&&E.t==='r'){const r=S.routines.find(x=>x.id===E.id);if(r)dv={...dv,...r,date:r.from,rec:'1'}}
  const items=agendaItems(d),tasks=items.filter(x=>x.kind==='task'&&!x.t.preview),dn=tasks.filter(x=>x.t.done).length;
  const next=d===h?nextTaskToday():null,inMin=next?mins(next.time)-nowMinutes():0;
  const hist=Object.keys(S.inst).filter(k=>k<h&&S.inst[k].some(t=>t.done)).sort().reverse().slice(0,7);
  const editing=!!E,instanceEdit=E&&E.t==='i';
  return `<section class="card agenda">
    <div class="agenda-head"><button class="g ic-b" type="button" data-a="dayShift" data-id="-1" aria-label="Día anterior">${ico('right',16).replace('class="i"','class="i flip"')}</button>
      <div class="agenda-title"><h2>${d===h?'Hoy':d===addDays(h,1)?'Mañana':d===addDays(h,-1)?'Ayer':''}</h2><span>${esc(fechaLarga(d))}</span></div>
      <button class="g ic-b" type="button" data-a="dayShift" data-id="1" aria-label="Día siguiente">${ico('right',16)}</button></div>
    <div class="agenda-tools"><label class="fl">Ir a una fecha<input type="date" value="${esc(d)}" data-a="viewDay"></label>${d!==h?'<button class="g" type="button" data-a="dayToday">Volver a hoy</button>':''}${tasks.length?`<span class="k">${dn} de ${tasks.length} tareas hechas</span>`:''}</div>
    ${next?`<div class="next-up">${ico('clock',16)}<span><b>${inMin<=0?'Ahora':'En '+(inMin>=60?Math.floor(inMin/60)+' h '+(inMin%60)+' min':inMin+' min')}:</b> ${esc(next.name)} a las ${esc(next.time)}</span></div>`:''}
    ${items.length?items.map(it=>agendaRow(it,d)).join(''):'<div class="empty">No hay nada en la agenda de este día. Agrega una tarea abajo.</div>'}
  </section>
  <section class="card" id="taskFormCard"><h2>${editing?'Editar':'Nueva tarea o rutina'}</h2><form id="fTask">
    <label class="fl">Actividad<input name="name" maxlength="120" placeholder="Ej. Gimnasio, estudiar inglés" value="${esc(dv.name)}" required></label>
    <label class="fl">Hora de inicio<input name="time" type="time" value="${esc(dv.time||'')}"></label><label class="fl">Hora de fin<input name="end" type="time" value="${esc(dv.end||'')}"></label>
    <label class="fl">Recordatorio<select name="remind">${REMIND_OPTS.map(([v,l])=>`<option value="${v}" ${String(dv.remind??'')===v?'selected':''}>${l}</option>`).join('')}</select></label>
    <label class="fl">Categoría<input name="cat" list="tcats" placeholder="Categoría" value="${esc(dv.cat)}"></label><datalist id="tcats">${TCATS.map(c=>`<option>${esc(c)}</option>`).join('')}</datalist>
    <label class="fl">Notas predeterminadas<input name="notes" maxlength="200" placeholder="Opcional" value="${esc(dv.notes)}"></label>
    ${instanceEdit?'':`<label class="fl">Repetición<select name="rec" ${editing?'disabled':''}><option value="0">Solo un día</option><option value="1" ${dv.rec==='1'?'selected':''}>Rutina (se repite)</option></select></label>
    <label class="fl">Fecha o inicio<input name="date" type="date" value="${esc(dv.date||d)}"></label>
    <label class="fl">Fin de la rutina (opcional)<input name="to" type="date" value="${esc(dv.to||'')}"></label>
    <fieldset class="days"><legend>Días de la rutina</legend>${DN.map((n,i)=>`<label><input type="checkbox" name="d${i}" ${dv.days.includes(i)?'checked':''}><span>${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][i]}</span></label>`).join('')}</fieldset>
    ${editing?'':'<label class="check-line"><input type="checkbox" name="doneNow" value="1"><span>Ya la hice (registrar como actividad realizada)</span></label>'}`}
    <button class="b">${editing?'Guardar cambios':'Agregar'}</button>${editing?'<button type="button" class="g" data-a="canE">Cancelar</button>':''}</form>
    <p class="k">Los recordatorios aparecen en tu agenda y en Inicio. Para recibirlos en el celular con la app cerrada hay que activar las notificaciones.</p></section>
  <section class="card"><h2>Mis rutinas</h2>${S.routines.length?S.routines.map(r=>`<div class="row"><div class="g1"><b>${esc(r.name)}</b> <span class="tag">${esc(r.cat)}</span> ${r.active?'':'<span class="tag">Pausada</span>'}<small>${DN.map((n,i)=>r.days.includes(i)?n:'·').join(' ')} · ${esc(r.time||'Sin hora')}${r.end?'–'+esc(r.end):''}${r.remind!==undefined&&r.remind!==''&&r.time?' · '+esc(remindLabel(r.remind)):''} · desde ${esc(r.from)}${r.to?' hasta '+esc(r.to):''}</small></div>
    <button class="g" type="button" data-a="edR" data-id="${esc(r.id)}">Editar</button><button class="g" type="button" data-a="togR" data-id="${esc(r.id)}">${r.active?'Pausar':'Activar'}</button><button class="g ic-b" type="button" data-a="delR" data-id="${esc(r.id)}" aria-label="Eliminar rutina ${esc(r.name)}">${ico('x',15)}</button></div>`).join(''):'<div class="empty">Aún no tienes rutinas. Crea una eligiendo «Rutina (se repite)».</div>'}</section>
  <section class="card"><h2>Historial reciente</h2>${hist.length?hist.map(k=>`<div class="row"><div class="g1"><b>${esc(dlabel(k))}</b> <small>${S.inst[k].filter(t=>t.done).length} de ${S.inst[k].length} completadas</small><small>${S.inst[k].filter(t=>t.done).map(t=>esc(t.name)+(t.real?' '+esc(t.real):'')+(t.note?' ('+esc(t.note)+')':'')).join(' · ')}</small></div></div>`).join(''):'<div class="empty">Aún no hay días completados.</div>'}</section>`;
}
