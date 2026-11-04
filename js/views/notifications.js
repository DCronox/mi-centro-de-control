/* ---- Sección Notificaciones: estado del dispositivo, preferencias, dispositivos e historial ---- */
const NOTIF_CATS=[['finanzas','Finanzas','Pagos próximos y vencidos, gastos importantes, presupuestos y ahorro'],['trabajo','Trabajo','Inicio de turnos, marcar la salida, registrar turnos y resumen semanal'],['metas','Metas','Fechas objetivo y avances'],['organizacion','Organización','Tareas con recordatorio y resumen del día']];
const DOW_NAMES=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
function notifStatusHtml(){
  const perm=notifPermission(),here=pushActiveHere(),busy=notif.busy?' disabled':'';
  let tone='muted',title='',text='',actions='';
  if(!pushSupported()){tone='warn';title='Este navegador no admite notificaciones push';text='Los recordatorios aparecerán dentro de la app y en el historial mientras la tengas abierta.'}
  else if(isIOS()&&!isStandalone()){tone='warn';title='Instala la app para recibir notificaciones';text='En iPhone abre esta página en Safari, toca Compartir › «Añadir a pantalla de inicio» y activa las notificaciones desde la app instalada.'}
  else if(here){tone='ok';title='Activadas en este dispositivo';text='Recibirás los avisos aunque la app esté cerrada, siempre que el sistema no los bloquee (ahorro de batería, modo no molestar).';actions=`<button class="b" type="button" data-a="testPush"${busy}>Enviar notificación de prueba</button><button class="g" type="button" data-a="disablePush"${busy}>Desactivar aquí</button>`}
  else if(perm==='denied'){tone='bad';title='El permiso está bloqueado';text='Actívalo en la configuración del sitio del navegador (candado junto a la dirección › Notificaciones › Permitir) y recarga la página.'}
  else if(!cloudUser){tone='warn';title='Inicia sesión para recibirlas con la app cerrada';text='El servidor calcula tus recordatorios a partir de los datos guardados en la nube. Mientras tanto puedes recibir avisos con la app abierta.';actions=`<button class="b" type="button" data-a="go" data-id="cuenta">Ir a Cuenta</button>${perm!=='granted'?`<button class="g" type="button" data-a="localAlerts">Avisos con la app abierta</button>`:''}`}
  else if(notif.serverReady===false){tone='warn';title='Falta configurar el servidor de notificaciones';text='La base de datos todavía no tiene las tablas de notificaciones. Mientras se configura, los recordatorios llegan solo con la app abierta.';actions=perm!=='granted'?`<button class="g" type="button" data-a="localAlerts">Avisos con la app abierta</button>`:''}
  else if(notif.serverReady===null&&!notif.loaded){title='Comprobando…';text=''}
  else{title='Recibe tus recordatorios en este dispositivo';text='Te avisaremos según tus preferencias de abajo. Primero te explicamos para qué es y luego el navegador pedirá permiso.';actions=`<button class="b" type="button" data-a="enablePush"${busy}>Activar notificaciones</button>`}
  return `<section class="card notif-status notif-${tone}"><div class="notif-status-head"><span class="notif-bell">${ico('bell',22)}</span><div><h2>${esc(title)}</h2><p class="k">${esc(text)}</p></div></div>${actions?`<div class="cloud-actions">${actions}</div>`:''}${perm==='granted'&&!here?'<p class="k">Avisos con la app abierta: permitidos.</p>':''}</section>`;
}
function notifPrefsHtml(){
  const p=notifPrefs(),sel=(name,opts,val)=>`<select name="${name}">${opts.map(([v,l])=>`<option value="${v}" ${String(val)===String(v)?'selected':''}>${l}</option>`).join('')}</select>`;
  return `<section class="card"><h2>Preferencias</h2><form id="fNotifPrefs" class="notif-prefs">
    <label class="switch-line wide"><span><b>Notificaciones</b><small>Interruptor general para todos tus dispositivos.</small></span><input type="checkbox" class="switch" role="switch" name="enabled" ${p.enabled?'checked':''}></label>
    <fieldset class="notif-cats"><legend>Qué quieres recibir</legend>${NOTIF_CATS.map(([k,n,d])=>`<label class="switch-line"><span><b>${n}</b><small>${d}</small></span><input type="checkbox" class="switch" role="switch" name="cat_${k}" ${p.categories[k]?'checked':''}></label>`).join('')}</fieldset>
    <label class="fl">Avisar de pagos${sel('paymentLeadDays',[[0,'Solo el día del vencimiento'],[1,'1 día antes'],[2,'2 días antes'],[3,'3 días antes'],[7,'1 semana antes']],p.paymentLeadDays)}</label>
    <label class="fl">Avisar antes del turno${sel('shiftLeadMin',[[0,'A la hora de entrada'],[15,'15 min antes'],[30,'30 min antes'],[60,'1 hora antes'],[120,'2 horas antes']],p.shiftLeadMin)}</label>
    <label class="fl">Avisar fechas de metas${sel('goalLeadDays',[[0,'Solo el día'],[3,'3 días antes'],[7,'1 semana antes'],[14,'2 semanas antes'],[30,'1 mes antes']],p.goalLeadDays)}</label>
    <label class="fl">Resumen del día y avisos de pagos<input type="time" name="summaryTime" value="${esc(p.summaryTime)}" required></label>
    <label class="fl">Resumen semanal de horas${sel('weeklyDay',DOW_NAMES.map((d,i)=>[i,'Cada '+d]),p.weeklyDay)}</label>
    <label class="fl">Hora del resumen semanal<input type="time" name="weeklyTime" value="${esc(p.weeklyTime)}" required></label>
    <label class="fl">No molestar desde<input type="time" name="quietStart" value="${esc(p.quietStart)}" required></label>
    <label class="fl">No molestar hasta<input type="time" name="quietEnd" value="${esc(p.quietEnd)}" required></label>
    <label class="fl">Gasto importante desde (COP)<input type="number" name="bigExpense" min="0" step="1000" value="${esc(p.bigExpense)}"></label>
    <label class="fl">Día del recordatorio de ahorro<input type="number" name="savingsDay" min="1" max="31" value="${esc(p.savingsDay)}"></label>
    <button class="b">Guardar preferencias</button></form>
    <p class="k">Horario de Colombia (America/Bogota). En «no molestar» solo se pausan los avisos de presupuesto, gastos y metas; los de turnos y tareas con recordatorio sí llegan porque los programaste tú. Las preferencias se guardan con tus datos y valen para todos tus dispositivos.</p></section>`;
}
function notifDevicesHtml(){
  if(!cloudUser||!notif.serverReady)return '';
  return `<section class="card"><h2>Dispositivos</h2>${notif.devices.length?notif.devices.map(d=>`<div class="row"><span class="ti">${ico(/Android|iPhone/.test(d.device)?'phone':'chart',16)}</span><div class="g1"><b>${esc(d.device)}${d.endpoint===notif.endpoint?' · este dispositivo':''}</b><small>Activado ${esc(dlabel(String(d.created_at).slice(0,10)))}${d.fail_count?` · <span class="warn">${d.fail_count} envío(s) fallido(s)</span>`:''}</small></div><input type="checkbox" class="switch" role="switch" data-a="devToggle" data-id="${esc(d.id)}" ${d.enabled?'checked':''} aria-label="Recibir en ${esc(d.device)}"><button class="g ic-b" type="button" data-a="devRemove" data-id="${esc(d.id)}" aria-label="Quitar ${esc(d.device)}">${ico('x',15)}</button></div>`).join(''):'<div class="empty">Aún no hay dispositivos. Activa las notificaciones en cada teléfono o computador donde quieras recibirlas.</div>'}</section>`;
}
function notifHistoryHtml(){
  const items=inboxItems(),unread=items.filter(x=>!x.read_at).length;
  const catIcon={finanzas:'wallet',trabajo:'clock',metas:'target',organizacion:'check',sistema:'bell'};
  return `<section class="card"><h2>Historial${unread?`<button class="lk" type="button" data-a="readAll">Marcar todo como leído</button>`:''}</h2>${items.length?items.map(n=>`<button type="button" class="notif-item ${n.read_at?'':'unread'}" data-a="openNotif" data-id="${esc(n.id)}" data-tab="${esc(n.tab||'dash')}"><span class="ti">${ico(catIcon[n.category]||'bell',16)}</span><span class="g1"><b>${esc(n.title)}</b><small>${esc(n.body||'')}</small><small class="k">${esc(dlabel(String(n.created_at).slice(0,10)))} · ${esc(new Date(n.created_at).toLocaleTimeString('es-CO',{timeZone:TZ,hour:'2-digit',minute:'2-digit'}))}${n.local?' · en la app':n.status==='sin_dispositivos'?' · sin dispositivos activos':n.status==='fallida'?' · no se pudo entregar':''}</small></span>${n.read_at?'':'<i class="unread-dot" aria-label="Sin leer"></i>'}</button>`).join(''):'<div class="empty">Aún no hay notificaciones. Aquí verás cada aviso enviado, también los que lleguen con la app cerrada.</div>'}</section>`;
}
function vNotif(){
  if(!notif.loaded&&!notif._loading){notif._loading=true;refreshNotif().finally(()=>{notif._loading=false;if(tab==='notif')softRender()})}
  return notifStatusHtml()+notifPrefsHtml()+notifDevicesHtml()+notifHistoryHtml();
}
