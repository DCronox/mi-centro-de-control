function goalHtml(g){
  const tot=g.aportes.reduce((s,a)=>s+a.amount,0),p=Math.min(100,tot/g.target*100),rest=Math.max(0,g.target-tot);
  let proy='';if(rest>0&&g.monthly>0){const m=Math.ceil(rest/g.monthly);proy=` · Meta en ~${m} mes(es) (${monthName(monthShift(mes(hoy()),m))})`}
  return `<div style="margin-bottom:12px"><b>${esc(g.name)}</b> <small class="k">${p.toFixed(0)}%</small><div class="bar"><i style="width:${p}%"></i></div><small class="k">${fmt(tot)} de ${fmt(g.target)} · faltan ${fmt(rest)}${proy}</small></div>`;
}
function vMetas(){
  return `<div class="card"><h2>Nueva meta</h2><form id="fGoal"><label class="fl">Nombre de la meta<input name="name" placeholder="Ej. Moto" required></label><label class="fl">Valor objetivo (COP)<input name="target" type="number" min="1" placeholder="0" required></label><label class="fl">Aporte mensual deseado (COP)<input name="monthly" type="number" min="0" placeholder="0"></label><button class="b">Crear meta</button></form></div>
  ${S.goals.length?S.goals.map(g=>`<div class="card">${goalHtml(g)}
  <form class="fAp" data-id="${esc(g.id)}"><label class="fl">Aporte (COP)<input name="amount" type="number" min="1" placeholder="0" required></label><button class="b">Aportar desde mi saldo</button><button type="button" class="g" data-a="delG" data-id="${esc(g.id)}">Eliminar meta</button></form>
  <small class="k">El aporte se descuenta de tu disponible como transferencia a ahorro, no como gasto.</small>
  ${g.aportes.slice(-5).reverse().map(a=>`<div class="row"><div class="g1">${esc(a.date)}</div><b>${fmt(a.amount)}</b></div>`).join('')}</div>`).join(''):'<div class="empty">Aún no tienes metas de ahorro.</div>'}`;
}
