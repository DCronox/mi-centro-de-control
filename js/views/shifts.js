/* ---- Turnos: programados (planeados) y realizados (historial), con marcación en el momento ----
   S.activeShift = {on:true,date,in,startedAt,rate,scheduledId?,u} mientras hay un turno en curso; {on:false,u} si no.
   Un turno realizado puede venir del reloj (source:'reloj'), de un programado (source:'programado') o registrarse a mano. */
const shiftPay=s=>horas(s)*(+s.rate||S.rate||0);
const activeShift=()=>S.activeShift&&S.activeShift.on?S.activeShift:null;
function shiftElapsedHours(a){return Math.max(0,(Date.now()-(+a.startedAt||Date.now()))/3600000)}
function liveShiftHtml(){
  const a=activeShift(),h=hoy(),today=(S.scheduledShifts||[]).filter(x=>x&&x.date===h).sort((x,y)=>String(x.in).localeCompare(String(y.in)))[0];
  if(a){const el=shiftElapsedHours(a),hh=Math.floor(el),mm=Math.floor((el-hh)*60);return `<section class="card live-shift on"><div class="live-head"><span class="live-dot" aria-hidden="true"></span><div><h2>En turno desde las ${esc(a.in)}</h2><p class="k">${esc(dlabel(a.date))} · ${hh} h ${String(mm).padStart(2,'0')} min · ${fmt(el*(+a.rate||S.rate))} estimados a ${fmt(+a.rate||S.rate)}/h</p></div></div>${el>14?'<p class="warn live-warn">Llevas más de 14 horas. Si olvidaste marcar la salida, márcala y corrige la hora en el historial.</p>':''}<div class="live-actions"><button class="b" type="button" data-a="clockOut">Marcar salida ahora</button><button class="g" type="button" data-a="clockCancel">Descartar</button></div></section>`}
  return `<section class="card live-shift"><div class="live-head"><div><h2>Marcar turno</h2><p class="k">${today?'Hoy tienes programado de '+esc(today.in)+' a '+esc(today.out)+'. Al marcar la entrada se registrará como realizado.':'Registra la entrada al llegar y la salida al terminar; las horas se calculan solas.'}</p></div></div><div class="live-actions"><button class="b" type="button" data-a="clockIn"${today?` data-id="${esc(today.id)}"`:''}>Marcar entrada ahora</button><span class="k">Tarifa: ${fmt(S.rate)}/h</span></div></section>`;
}
function scheduledShiftsHtml(){
  const h=hoy(),a=(S.scheduledShifts||[]).filter(Boolean).slice().sort((x,y)=>x.date.localeCompare(y.date)||String(x.in).localeCompare(String(y.in)));
  const rows=a.map(x=>{const past=x.date<h,hrs=horas(x);return `<div class="row"><span class="ti ${past?'ti-bad':''}">${ico('clock',16)}</span><div class="g1"><b>${esc(x.name||'Turno de trabajo')}</b><small>${past?'<span class="warn">Ya pasó · regístralo o cancélalo</span> · ':''}${esc(dlabel(x.date))} · ${esc(x.in)}–${esc(x.out)} · ${hrs.toFixed(1)} h · ${fmt(shiftPay(x))} estimados</small></div><button class="g" type="button" data-a="recordScheduled" data-id="${esc(x.id)}">Registrar realizado</button><button class="g" type="button" data-a="delScheduled" data-id="${esc(x.id)}">Cancelar</button></div>`}).join('');
  return `<section class="card"><h2>Programados</h2>${rows||'<div class="empty">No hay turnos programados.</div>'}</section>`;
}
function vTurnos(){
  S.scheduledShifts=Array.isArray(S.scheduledShifts)?S.scheduledShifts:[];
  const h=hoy(),m=mes(h),L=[...S.shifts].sort((a,b)=>b.date.localeCompare(a.date)||String(b.in).localeCompare(String(a.in)));
  const month=S.shifts.filter(s=>mes(s.date)===m),hm=month.reduce((x,s)=>x+horas(s),0),earned=month.reduce((x,s)=>x+shiftPay(s),0);
  const unpaid=S.shifts.filter(s=>!s.paid).reduce((x,s)=>x+shiftPay(s),0),received=S.shifts.filter(s=>s.paid&&mes(s.date)===m).reduce((x,s)=>x+(+s.received||0),0);
  const next=S.scheduledShifts.filter(x=>x&&x.date>=h&&x.date<=addDays(h,7)),nh=next.reduce((x,s)=>x+horas(s),0),ne=next.reduce((x,s)=>x+shiftPay(s),0);
  let last='';const hist=L.map(s=>{const hr=horas(s),head=mes(s.date)!==last?(last=mes(s.date),`<div class="dh">${esc(monthName(last))}</div>`):'';return head+`<div class="row"><div class="g1"><b>${esc(dlabel(s.date))} · ${esc(s.in)}–${esc(s.out)}</b><small>${hr.toFixed(2)} h × ${fmt(s.rate)} = ${fmt(hr*s.rate)}${+s.brk?' · descanso '+(+s.brk)+' min':''}${s.source==='reloj'?' · marcado en el momento':s.source==='programado'?' · desde programado':''}</small><small class="${s.paid?'ok':'warn'}">${s.paid?'Pagado: '+fmt(s.received):'Pendiente de pago'}</small></div>${s.paid?'':`<button class="g" type="button" data-a="paySh" data-id="${esc(s.id)}">Registrar pago</button>`}<button class="g ic-b" type="button" data-a="delSh" data-id="${esc(s.id)}" aria-label="Eliminar turno del ${esc(s.date)}">${ico('x',15)}</button></div>`}).join('');
  return liveShiftHtml()+`<section class="card"><div class="stats">
      <div><span class="k">Horas realizadas este mes</span><b>${hm.toFixed(1)} h</b><small>${month.length} turno(s)</small></div>
      <div><span class="k">Ingreso estimado del mes</span><b>${fmt(earned)}</b><small>Horas × tarifa</small></div>
      <div><span class="k">Cobrado este mes</span><b class="ok">${fmt(received)}</b><small>Pagos registrados</small></div>
      <div><span class="k">Por cobrar</span><b class="${unpaid?'warn':''}">${fmt(unpaid)}</b><small>Turnos sin pago registrado</small></div>
      <div><span class="k">Próximos 7 días</span><b>${nh.toFixed(1)} h</b><small>${fmt(ne)} estimados · programados</small></div>
    </div></section>
    ${scheduledShiftsHtml()}
    <div class="cols">
      <section class="card"><h2>Programar turno</h2><form id="fSchedule" class="schedule-form"><label class="fl">Fecha<input name="date" type="date" value="${h}" required></label><label class="fl">Nombre (opcional)<input name="name" maxlength="80" placeholder="Turno de trabajo"></label><label class="fl">Entrada<input name="in" type="time" required></label><label class="fl">Salida<input name="out" type="time" required></label><label class="fl">Descanso no pago (min)<input name="brk" type="number" min="0" value="0"></label><button class="b">Programar turno</button></form></section>
      <section class="card"><h2>Registrar turno realizado</h2><form id="fShift"><label class="fl">Fecha<input name="date" type="date" value="${h}" required></label><label class="fl">Entrada<input name="in" type="time" required></label><label class="fl">Salida<input name="out" type="time" required></label><label class="fl">Descanso no pago (min)<input name="brk" type="number" min="0" value="0"></label><label class="fl">Tarifa por hora (COP)<input name="rate" type="number" min="1" value="${esc(S.rate)}" required></label><button class="b">Guardar turno</button></form><p class="k">Si la salida es menor que la entrada, se cuenta como turno que cruza la medianoche.</p></section>
    </div>
    <section class="card"><h2>Historial de turnos realizados</h2>${hist||'<div class="empty">Aún no hay turnos realizados. Márcalos en el momento o regístralos arriba.</div>'}</section>`;
}
