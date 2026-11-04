/* ---- Metas: de ahorro (en COP, descuentan del disponible) y personales (en la unidad que elijas) ----
   Campos opcionales nuevos, compatibles con las metas existentes:
   kind ('ahorro' por defecto | 'personal'), unit, targetDate (AAAA-MM-DD), progress (avances de metas personales).
   Los retiros de una meta de ahorro se guardan como aportes negativos (vuelven al disponible). */
const isPersonalGoal=g=>g&&g.kind==='personal';
const daysBetween=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
const goalLog=g=>(isPersonalGoal(g)?g.progress:g.aportes)||[];
const fmtQty=(n,unit)=>(Math.round(n*100)/100).toLocaleString('es-CO')+(unit?' '+unit:'');
function goalModel(g){
  const h=hoy(),personal=isPersonalGoal(g),log=goalLog(g),done=log.reduce((s,x)=>s+(+x.amount||0),0),target=+g.target||0;
  const rest=Math.max(0,target-done),pct=target?Math.max(0,Math.min(100,done/target*100)):0;
  const show=v=>personal?fmtQty(v,g.unit||''):fmt(v);
  /* Ritmo real: solo con al menos 30 días de historial; se mide en los últimos 90 días. */
  const first=log.map(x=>x.date).filter(Boolean).sort()[0];let pace=null;
  if(first&&daysBetween(first,h)>=30){const from=addDays(h,-90)>first?addDays(h,-90):first,sum=log.filter(x=>x.date>=from).reduce((s,x)=>s+(+x.amount||0),0);pace=sum/Math.max(1,daysBetween(from,h)/30.44)}
  const daysLeft=g.targetDate?daysBetween(h,g.targetDate):null;
  const need=g.targetDate&&rest>0&&daysLeft>0?rest/Math.max(1,daysLeft/30.44):null;
  let status='',tone='';
  if(target&&rest===0){status='Cumplida';tone='ok'}
  else if(g.targetDate&&daysLeft<0){status='La fecha objetivo ya pasó';tone='bad'}
  else if(need!==null&&pace!==null){if(pace>=need){status='Vas a tiempo';tone='ok'}else{status='A este ritmo no llegas a la fecha';tone='warn'}}
  else if(need!==null){status='Aún no hay historial suficiente para saber si llegas a tiempo';tone=''}
  const etaMonths=pace>0&&rest>0?Math.ceil(rest/pace):null,planMonths=(+g.monthly>0)&&rest>0?Math.ceil(rest/+g.monthly):null;
  return{personal,log,done,target,rest,pct,show,pace,need,daysLeft,status,tone,etaMonths,planMonths};
}
function goalCardHtml(g){
  const m=goalModel(g),h=hoy(),editing=window._editGoal===g.id,unit=m.personal?(g.unit||''):'COP';
  const etaText=n=>'~'+n+' mes(es) · '+monthName(monthShift(mes(h),n));
  const facts=[
    ['Fecha objetivo',g.targetDate?esc(fechaLarga(g.targetDate))+(m.daysLeft>=0?' · faltan '+m.daysLeft+' días':''):'Sin fecha'],
    ['Ritmo real',m.pace!==null?esc(m.show(Math.round(m.pace)))+'/mes · últimos 90 días':'Necesita 30 días de historial'],
    ['Para llegar a tiempo',m.need!==null?esc(m.show(Math.ceil(m.need)))+'/mes':(g.targetDate?'—':'Define una fecha objetivo')],
    ['Proyección',m.rest===0?'Meta cumplida':m.etaMonths?'Con tu ritmo real: '+etaText(m.etaMonths):m.planMonths?'Con el ritmo planeado: '+etaText(m.planMonths):'Sin datos suficientes'],
  ];
  const entries=m.log.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const history=entries.length?`<details class="goal-history"><summary>Historial (${entries.length})</summary>${entries.map(x=>`<div class="row"><div class="g1"><b>${esc(dlabel(x.date))}</b>${x.note?`<small>${esc(x.note)}</small>`:''}</div><b class="amt ${(+x.amount)<0?'bad':''}">${(+x.amount)<0?'Retiro ':''}${esc(m.show(Math.abs(+x.amount||0)))}</b><button class="g ic-b" type="button" data-a="delAp" data-id="${esc(g.id)}" data-entry="${esc(x.id)}" aria-label="Eliminar registro del ${esc(x.date)}">${ico('x',15)}</button></div>`).join('')}</details>`:'<p class="k">Aún no hay registros.</p>';
  const edit=editing?`<form class="fGoalEdit goal-edit" data-id="${esc(g.id)}"><label class="fl">Nombre<input name="name" maxlength="80" value="${esc(g.name)}" required></label><label class="fl">Objetivo (${esc(unit)})<input name="target" type="number" min="0.01" step="any" value="${esc(g.target)}" required></label>${m.personal?`<label class="fl">Unidad<input name="unit" maxlength="20" value="${esc(g.unit||'')}"></label>`:''}<label class="fl">Ritmo mensual planeado<input name="monthly" type="number" min="0" step="any" value="${esc(g.monthly||0)}"></label><label class="fl">Fecha objetivo<input name="targetDate" type="date" value="${esc(g.targetDate||'')}"></label><button class="b">Guardar cambios</button><button class="g" type="button" data-a="canEG">Cancelar</button></form>`:'';
  return `<section class="card goal-card">
    <div class="goal-head"><div><h2>${esc(g.name)}</h2><span class="tag">${m.personal?'Personal':'Ahorro'}</span>${m.status?` <span class="chip chip-${m.tone||'muted'}">${esc(m.status)}</span>`:''}</div>${ringSvg(m.pct)}</div>
    <div class="bar bar-lg" role="progressbar" aria-label="Progreso de ${esc(g.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(m.pct)}"><i style="width:${m.pct.toFixed(1)}%"></i></div>
    <p class="goal-numbers">Llevas <b>${esc(m.show(m.done))}</b> de ${esc(m.show(m.target))} · faltan ${esc(m.show(m.rest))}</p>
    <dl class="goal-facts">${facts.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    ${edit}
    <form class="fAp goal-actions" data-id="${esc(g.id)}"><label class="fl">${m.personal?'Avance ('+esc(g.unit||'unidades')+')':'Valor (COP)'}<input name="amount" type="number" min="0.01" step="any" inputmode="decimal" placeholder="0" required></label>${m.personal?`<label class="fl">Nota (opcional)<input name="note" maxlength="80"></label>`:''}<button class="b">${m.personal?'Registrar avance':'Aportar desde mi saldo'}</button>${m.personal?'':`<button class="g" type="button" data-a="withdrawG" data-id="${esc(g.id)}">Retirar</button>`}</form>
    ${m.personal?'':'<p class="k">Los aportes se descuentan de tu disponible como ahorro, no como gasto. Un retiro los devuelve.</p>'}
    ${history}
    <div class="goal-tools">${editing?'':`<button class="g" type="button" data-a="editG" data-id="${esc(g.id)}">${ico('edit',15)}<span>Editar meta</span></button>`}<button class="g danger" type="button" data-a="delG" data-id="${esc(g.id)}">Eliminar meta</button></div>
  </section>`;
}
/* Resumen corto usado en Inicio. */
function goalHtml(g){const m=goalModel(g);return `<div class="goal-mini"><div class="goal-mini-head"><b>${esc(g.name)}</b><span>${Math.round(m.pct)}%</span></div><div class="bar"><i style="width:${m.pct.toFixed(1)}%"></i></div><small class="k">${esc(m.show(m.done))} de ${esc(m.show(m.target))}${m.status?' · '+esc(m.status):''}</small></div>`}
function vMetas(){
  const money=S.goals.filter(g=>!isPersonalGoal(g)),personal=S.goals.filter(isPersonalGoal);
  return `<div class="card"><h2>Nueva meta</h2><form id="fGoal" class="goal-form">
    <div class="seg" style="grid-column:1/-1;justify-self:start"><label><input type="radio" name="kind" value="ahorro" checked><span>De ahorro</span></label><label><input type="radio" name="kind" value="personal"><span>Personal</span></label></div>
    <label class="fl">Nombre<input name="name" maxlength="80" placeholder="Ej. Moto, Leer 12 libros" required></label>
    <label class="fl">Objetivo<input name="target" type="number" min="0.01" step="any" placeholder="0" required></label>
    <label class="fl">Unidad (solo personales)<input name="unit" maxlength="20" placeholder="libros, km, horas"></label>
    <label class="fl">Ritmo mensual planeado<input name="monthly" type="number" min="0" step="any" placeholder="0"></label>
    <label class="fl">Fecha objetivo (opcional)<input name="targetDate" type="date"></label>
    <button class="b">Crear meta</button></form>
    <p class="k">En las metas de ahorro el objetivo y el ritmo van en COP.</p></div>
  ${S.goals.length?'':'<div class="empty">Aún no tienes metas. Crea una de ahorro (por ejemplo, una moto) o personal (por ejemplo, leer 12 libros).</div>'}
  ${money.length?`<h2 class="section-title">De ahorro</h2>${money.map(goalCardHtml).join('')}`:''}
  ${personal.length?`<h2 class="section-title">Personales</h2>${personal.map(goalCardHtml).join('')}`:''}`;
}
