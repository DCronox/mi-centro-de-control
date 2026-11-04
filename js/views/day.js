function vDia(){
  const d=viewDay,h=hoy();
  let dv={name:'',time:'',end:'',cat:'',notes:'',date:d,to:'',days:[1,2,3,4,5],rec:'0'};
  if(E&&E.t==='i'){const i=getI(E.d,E.id);if(i)dv={...dv,...i,notes:i.note||''}}
  if(E&&E.t==='r'){const r=S.routines.find(x=>x.id===E.id);if(r)dv={...dv,...r,date:r.from,rec:'1'}}
  let ts=inst(d);
  if(d>h)ts=ts.concat(S.routines.filter(r=>r.active&&r.days.includes(dow(d))&&d>=r.from&&(!r.to||d<=r.to)).map(r=>({id:r.id,rid:r.id,name:r.name,time:r.time,end:r.end,cat:r.cat,preview:true}))).sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));
  const hist=Object.keys(S.inst).filter(k=>k<h&&S.inst[k].some(t=>t.done)).sort().reverse().slice(0,7);
  return `<div class="card"><h2>${E?'Editar':'Nueva tarea o rutina'}</h2><form id="fTask">
  <label class="fl">Actividad<input name="name" placeholder="Actividad" value="${esc(dv.name)}" required></label>
  <label class="fl">Hora de inicio<input name="time" type="time" value="${esc(dv.time||'')}"></label><label class="fl">Hora de fin<input name="end" type="time" value="${esc(dv.end||'')}"></label>
  <label class="fl">Categoría<input name="cat" list="tcats" placeholder="Categoría" value="${esc(dv.cat)}"></label><datalist id="tcats">${TCATS.map(c=>`<option>${c}</option>`).join('')}</datalist>
  <label class="fl">Notas predeterminadas<input name="notes" placeholder="Notas predeterminadas" value="${esc(dv.notes)}"></label>
  <div style="display:${E&&E.t==='i'?'none':'contents'}">
  <label class="fl">Repetición<select name="rec" ${E?'disabled':''}><option value="0">Solo un día</option><option value="1" ${dv.rec==='1'?'selected':''}>Rutina (se repite)</option></select></label>
  <label class="k">Fecha / inicio<input name="date" type="date" value="${esc(dv.date||d)}"></label>
  <label class="k">Fin (opcional)<input name="to" type="date" value="${esc(dv.to||'')}"></label>
  <div class="cb" style="grid-column:1/-1;flex-wrap:wrap">${DN.map((n,i)=>`<label><input type="checkbox" name="d${i}" ${dv.days.includes(i)?'checked':''}> ${n}</label>`).join(' ')}<small class="k">(días, solo para rutinas)</small></div></div>
  <button class="b">${E?'Guardar cambios':'Agregar'}</button>${E?'<button type="button" class="g" data-a="canE">Cancelar</button>':''}</form></div>
  <div class="card"><h2>Mis rutinas</h2>${S.routines.length?S.routines.map(r=>`<div class="row"><div class="g1"><b>${esc(r.name)}</b> <span class="tag">${esc(r.cat)}</span> ${r.active?'':'<span class="tag">pausada</span>'}<small>${DN.map((n,i)=>r.days.includes(i)?n:'·').join(' ')} · ${esc(r.time||'Sin hora')}${r.end?'–'+esc(r.end):''} · desde ${esc(r.from)}${r.to?' hasta '+esc(r.to):''}</small></div>
  <button class="g" data-a="edR" data-id="${esc(r.id)}">Editar</button><button class="g" data-a="togR" data-id="${esc(r.id)}">${r.active?'Pausar':'Activar'}</button><button class="g" type="button" data-a="delR" data-id="${esc(r.id)}" aria-label="Eliminar rutina ${esc(r.name)}">${ico('x',15)}</button></div>`).join(''):'<div class="empty">Aún no tienes rutinas. Crea una eligiendo “Rutina (se repite)”.</div>'}</div>
  <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 style="margin:0">${d===h?'Hoy · ':''}${fechaLarga(d)}</h2>
  <label class="fl">Elegir día<input aria-label="Elegir día" type="date" value="${esc(d)}" style="width:auto" data-a="viewDay"></label></div>
  ${ts.length?ts.map(t=>{const c=t.preview?'':clash(d,t);return `<div class="row ${t.done?'done':''}">${t.preview?'<span class="tag">prog.</span>':`<input type="checkbox" ${t.done?'checked':''} data-a="tgl" data-id="${esc(t.id)}" aria-label="Marcar ${esc(t.name)} como completada">`}
  <div class="g1"><span class="t">${esc(t.name)}</span> ${t.rid?'<span class="tag">rutina</span>':''} ${t.cat?`<span class="tag">${esc(t.cat)}</span>`:''}<small>${esc(t.time||'Sin hora')}${t.end?'–'+esc(t.end):''}${t.real?' · real '+esc(t.real):''}${c?` · <span class="warn">⚠ cruce con ${esc(c)}</span>`:''}</small>
  ${t.preview?'':`<input placeholder="Notas del día" aria-label="Notas para ${esc(t.name)}" value="${esc(t.note||'')}" data-a="note" data-id="${esc(t.id)}" style="margin-top:4px">`}</div>
  ${t.preview?'':`<button class="g" type="button" data-a="edI" data-id="${esc(t.id)}" aria-label="Editar tarea ${esc(t.name)}">${ico('edit',15)}</button><button class="g" type="button" data-a="delT" data-id="${esc(t.id)}" aria-label="Eliminar tarea ${esc(t.name)} de este día">${ico('x',15)}</button>`}</div>`}).join(''):'<div class="empty">No hay tareas para este día.</div>'}</div>
  <div class="card"><h2>Historial reciente</h2>${hist.length?hist.map(k=>`<div class="row"><div class="g1"><b>${esc(k)}</b> <small style="display:inline">${S.inst[k].filter(t=>t.done).length}/${S.inst[k].length} completadas</small><small>${S.inst[k].filter(t=>t.done).map(t=>esc(t.name)+(t.real?' '+esc(t.real):'')+(t.note?' ('+esc(t.note)+')':'')).join(' · ')}</small></div></div>`).join(''):'<div class="empty">Aún no hay días completados.</div>'}</div>`;
}
