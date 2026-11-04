/* ---- Inicio: lo importante primero ----
   1. Disponible y cómo se reparte el mes.  2. Alertas (solo si hay).  3. Hoy y los próximos 7 días.
   4. Metas, gastos por categoría y la semana. Todo se calcula con los datos registrados. */
const sumAmount=list=>list.reduce((s,t)=>s+(+t.amount||0),0);
function goalSaved(g){return (g.aportes||[]).reduce((s,a)=>s+(+a.amount||0),0)}
function dashAlerts(){
  const h=hoy(),soon=addDays(h,3),m=mes(h),items=[];
  const pend=S.tx.filter(t=>t.type==='gasto'&&t.status==='pendiente');
  const overdue=pend.filter(t=>t.date<h);
  if(overdue.length)items.push({tone:'bad',title:overdue.length===1?'Tienes un pago vencido':'Tienes '+overdue.length+' pagos vencidos',detail:(overdue.length===1?overdue[0].name+' · ':'')+fmt(sumAmount(overdue)),go:'mov'});
  const due=pend.filter(t=>t.date>=h&&t.date<=soon).sort((a,b)=>a.date.localeCompare(b.date));
  if(due.length)items.push({tone:'warn',title:due.length===1?due[0].name+' vence '+(due[0].date===h?'hoy':dlabel(due[0].date).toLowerCase()):due.length+' pagos vencen en los próximos 3 días',detail:fmt(sumAmount(due)),go:'mov'});
  (S.budgets||[]).filter(b=>b&&Number(b.amount)>0).forEach(b=>{const used=monthlyCategorySpend(b.cat,m),pct=used/Number(b.amount)*100;if(pct>=80)items.push({tone:pct>=100?'bad':'warn',title:(pct>=100?'Superaste el presupuesto de ':'Vas en el '+Math.round(pct)+'% del presupuesto de ')+b.cat,detail:fmt(used)+' de '+fmt(b.amount),go:'mov'})});
  const shiftToday=(S.scheduledShifts||[]).filter(x=>x&&x.date===h).sort((a,b)=>String(a.in).localeCompare(String(b.in)))[0];
  if(shiftToday)items.push({tone:'info',title:'Hoy tienes turno de '+shiftToday.in+' a '+shiftToday.out,detail:shiftToday.name||'Turno de trabajo',go:'turnos'});
  const pastScheduled=(S.scheduledShifts||[]).filter(x=>x&&x.date<h);
  if(pastScheduled.length)items.push({tone:'warn',title:pastScheduled.length===1?'Un turno programado ya pasó':pastScheduled.length+' turnos programados ya pasaron',detail:'Regístralos como realizados o cancélalos',go:'turnos'});
  return items.slice(0,4);
}
function dashHero(){
  const c=calc(),h=hoy(),m=mes(h),prev=monthShift(m,-1),prevCut=prev+'-'+String(Math.min(Number(h.slice(8,10))||1,monthDays(prev))).padStart(2,'0'),before=reportTotals(prev,prevCut);
  const saved=S.goals.reduce((x,g)=>x+(g.aportes||[]).filter(a=>mes(a.date)===m).reduce((y,a)=>y+(+a.amount||0),0),0);
  const free=c.ing-c.gas-saved,total=Math.max(c.ing,c.gas+saved,1);
  const seg=(v,cls,label)=>v>0?`<i class="rib-${cls}" style="width:${(v/total*100).toFixed(2)}%" title="${esc(label)}: ${esc(fmt(v))}"></i>`:'';
  const cmp=before.gas>0?compareValue(c.gas,before.gas,false):null,gasDelta=before.gas>0?Math.round((c.gas-before.gas)/before.gas*100):0;
  const ribbon=c.ing>0||c.gas>0||saved>0?`<div class="ribbon" role="img" aria-label="Este mes: ingresos ${esc(fmt(c.ing))}, gastos ${esc(fmt(c.gas))}, ahorro ${esc(fmt(saved))}">${seg(c.gas,'gas','Gastos')}${seg(saved,'save','Ahorro')}${seg(Math.max(0,free),'free','Sin asignar')}</div>`:'';
  return `<section class="hero" aria-label="Resumen del mes">
    <div class="hero-main">
      <span class="hero-label">Disponible</span>
      <div class="hero-amount ${c.bal<0?'neg':''}">${fmt(c.bal)}</div>
      <p class="hero-note">Ingresos recibidos menos gastos pagados y aportes a metas, desde tu primer registro.</p>
    </div>
    <div class="hero-month">
      <div class="hero-month-head"><span>${esc(monthName(m))}</span>${c.ing>0?`<span>${free>=0?'Te queda '+fmt(free)+' sin asignar':'Gastaste '+fmt(-free)+' más de lo que entró'}</span>`:'<span>Aún no registras ingresos este mes</span>'}</div>
      ${ribbon}
      <dl class="hero-legend">
        <div><dt><i class="dot dot-in"></i>Ingresos</dt><dd>${fmt(c.ing)}</dd></div>
        <div><dt><i class="dot dot-gas"></i>Gastos</dt><dd>${fmt(c.gas)}${cmp?`<small class="${cmp.cls==='good'?'ok':cmp.cls==='bad'?'bad':''}">${gasDelta>0?'+':''}${gasDelta}% vs. el mes pasado a esta fecha</small>`:''}</dd></div>
        <div><dt><i class="dot dot-save"></i>Ahorro del mes</dt><dd>${fmt(saved)}</dd></div>
        <div><dt>Por pagar</dt><dd>${fmt(c.pGas)}</dd></div>
        <div><dt>Por recibir</dt><dd>${fmt(c.pIng)}</dd></div>
      </dl>
    </div>
  </section>`;
}
function dashUpcoming(){
  const h=hoy(),limit=addDays(h,7);
  const pays=S.tx.filter(t=>t.type==='gasto'&&t.status==='pendiente'&&t.date<=limit).map(t=>({kind:'pay',date:t.date,t}));
  const shifts=(S.scheduledShifts||[]).filter(x=>x&&x.date>=h&&x.date<=limit).map(x=>({kind:'shift',date:x.date,x}));
  const rows=[...pays,...shifts].sort((a,b)=>a.date.localeCompare(b.date)||(a.kind==='pay'?-1:1)).slice(0,7);
  const body=rows.length?rows.map(r=>r.kind==='pay'
    ?`<div class="row"><span class="ti ${r.t.date<h?'ti-bad':''}">${ico('wallet',16)}</span><div class="g1"><b class="t">${esc(r.t.name)}</b><small>${r.t.date<h?'<span class="bad">Vencido</span> · ':''}${esc(dlabel(r.t.date))} · ${esc(r.t.cat||'Otros')}</small></div><b class="amt">${fmt(r.t.amount)}</b><button class="g" type="button" data-a="pay" data-id="${esc(r.t.id)}">Pagado</button></div>`
    :`<div class="row"><span class="ti">${ico('clock',16)}</span><div class="g1"><b class="t">${esc(r.x.name||'Turno de trabajo')}</b><small>${esc(dlabel(r.x.date))} · ${esc(r.x.in)}–${esc(r.x.out)} · ${horas(r.x).toFixed(1)} h · ${fmt(horas(r.x)*(+r.x.rate||S.rate))} estimados</small></div></div>`).join('')
    :'<div class="empty">Nada pendiente en los próximos 7 días.</div>';
  return `<section class="card"><h2>Próximos 7 días<button class="lk" type="button" data-a="go" data-id="mov">Ver pagos</button></h2>${body}</section>`;
}
function dashToday(){
  const h=hoy(),ts=inst(h),dn=ts.filter(t=>t.done).length,pct=ts.length?Math.round(dn/ts.length*100):0;
  const list=ts.slice().sort((a,b)=>(a.done?1:0)-(b.done?1:0)).slice(0,6);
  return `<section class="card"><h2>Hoy<button class="lk" type="button" data-a="go" data-id="dia">Abrir Mi día</button></h2>
    ${ts.length?`<div class="k">${dn} de ${ts.length} completadas</div><div class="bar" role="progressbar" aria-label="Tareas completadas hoy" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>`:''}
    ${ts.length?list.map(t=>`<div class="row ${t.done?'done':''}"><input type="checkbox" ${t.done?'checked':''} data-a="tgl" data-d="${h}" data-id="${esc(t.id)}" aria-label="Completar ${esc(t.name)}"><div class="g1"><span class="t">${esc(t.name)}</span><small>${esc(t.time||'Sin hora')}${t.end?'–'+esc(t.end):''}</small></div></div>`).join('')+(ts.length>list.length?`<p class="k more-note">y ${ts.length-list.length} más en Mi día</p>`:''):'<div class="empty">No tienes tareas para hoy. Agrégalas en Mi día.</div>'}
  </section>`;
}
function dashGoals(){
  const m=mes(hoy()),goals=S.goals.filter(g=>g&&+g.target>0);
  if(!goals.length)return `<section class="card"><h2>Metas<button class="lk" type="button" data-a="go" data-id="metas">Crear meta</button></h2><div class="empty">Crea una meta para ver cuánto te falta y cuándo la alcanzarías.</div></section>`;
  const monthly=goals.reduce((x,g)=>x+(+g.monthly||0),0),done=goals.reduce((x,g)=>x+(g.aportes||[]).filter(a=>mes(a.date)===m).reduce((y,a)=>y+(+a.amount||0),0),0);
  const rows=goals.map(g=>({g,saved:goalSaved(g)})).sort((a,b)=>(b.saved/b.g.target)-(a.saved/a.g.target)).slice(0,3).map(({g,saved})=>{const p=Math.min(100,saved/g.target*100);return `<div class="goal-mini"><div class="goal-mini-head"><b>${esc(g.name)}</b><span>${Math.round(p)}%</span></div><div class="bar"><i style="width:${p.toFixed(1)}%"></i></div><small class="k">${fmt(saved)} de ${fmt(g.target)}</small></div>`}).join('');
  return `<section class="card"><h2>Metas<button class="lk" type="button" data-a="go" data-id="metas">Ver metas</button></h2>${monthly?`<p class="k">Aportado este mes: ${fmt(done)} de ${fmt(monthly)} planeados</p>`:''}${rows}</section>`;
}
function dashCategories(){
  const cats=Object.entries(expenseCategories(mes(hoy()))).sort((a,b)=>b[1]-a[1]),mx=Math.max(1,...cats.map(x=>x[1]));
  return `<section class="card"><h2>Gastos del mes<button class="lk" type="button" data-a="go" data-id="inf">Ver informes</button></h2>${cats.length?cats.slice(0,5).map(([k,v])=>`<div class="cb"><span title="${esc(k)}">${esc(k)}</span><div class="bar"><i style="width:${(v/mx*100).toFixed(1)}%"></i></div><span>${fmt(v)}</span></div>`).join(''):'<div class="empty">Aún no hay gastos pagados este mes.</div>'}</section>`;
}
function dashWeek(){
  const h=hoy(),m=mes(h);let total=0,done=0;
  for(let i=0;i<7;i++){const d=addDays(h,-i),l=S.inst[d]||[];total+=l.length;done+=l.filter(t=>t.done).length}
  const hours=S.shifts.filter(s=>mes(s.date)===m).reduce((x,s)=>x+horas(s),0),unpaid=S.shifts.filter(s=>!s.paid).reduce((x,s)=>x+horas(s)*(+s.rate||0),0);
  return `<section class="card"><h2>Tu semana<button class="lk" type="button" data-a="go" data-id="turnos">Ver turnos</button></h2><div class="stats">
    <div><span class="k">Tareas cumplidas (7 días)</span><b>${total?done+' de '+total:'Sin tareas'}</b></div>
    <div><span class="k">Horas trabajadas este mes</span><b>${hours.toFixed(1)} h</b></div>
    <div><span class="k">Turnos por cobrar</span><b class="${unpaid>0?'warn':''}">${fmt(unpaid)}</b></div>
  </div></section>`;
}
function vDash(){
  const alerts=dashAlerts();
  return dashHero()+
    (alerts.length?`<section class="alerts" aria-label="Alertas">${alerts.map(a=>`<button type="button" class="alert alert-${a.tone}" data-a="go" data-id="${a.go}"><span class="alert-ico">${ico(a.tone==='info'?'clock':'alert',18)}</span><span class="alert-text"><b>${esc(a.title)}</b><small>${esc(a.detail)}</small></span>${ico('right',16)}</button>`).join('')}</section>`:'')+
    `<div class="dash-grid">${dashToday()}${dashUpcoming()}${dashGoals()}${dashCategories()}</div>${dashWeek()}`;
}
