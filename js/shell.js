let tab='dash',day=hoy(),viewDay=day;
const IC={
  chart:'<path d="M4 19V5m0 14h16"/><path d="m7 14 4-4 3 3 5-7"/>',
  home:'<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  wallet:'<path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3"/><path d="M21 10h-4a2 2 0 0 0 0 4h4z"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  more:'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  alert:'<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
  up:'<path d="M12 19V5m0 0-6 6m6-6 6 6"/>',
  down:'<path d="M12 5v14m0 0-6-6m6 6 6-6"/>',
  right:'<path d="m9 6 6 6-6 6"/>'
};
const ico=(n,z=18)=>`<svg class="i" width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
let _tt;function toast(m,kind='success'){if(saveFailed){m='No se guardaron los cambios. Descarga una copia e inténtalo de nuevo.';saveFailed=false;kind='error'}sfx(kind);let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');document.body.appendChild(t)}t.textContent=m;t.dataset.kind=kind;t.className='';void t.offsetWidth;t.className='show';clearTimeout(_tt);_tt=setTimeout(()=>t.className='',3000)}
const txRow=(t,act)=>{const inc=t.type==='ingreso',refund=t.type==='devolucion',neutral=['transferencia','pago_tarjeta','anulada'].includes(t.type),p=t.status==='pendiente',label={ingreso:'Ingreso',gasto:'Gasto',devolucion:'Devolución',transferencia:'Transferencia propia',pago_tarjeta:'Pago de tarjeta',anulada:'Anulada o reversada'}[t.type]||'Movimiento',sign=inc||refund?'+':neutral?'↔':'−',icon=inc||refund?'up':neutral?'check':'down';return '<div class="row"><span class="ti '+(inc||refund?'in':neutral?'nu-neutral':'')+'">'+ico(icon,16)+'</span><div class="g1"><b class="t">'+esc(t.name)+'</b><small>'+(act?'':esc(t.date)+' · ')+esc(label)+' · '+esc(t.cat||'Otros')+(t.method?' · '+esc(t.method):'')+(t.nuProduct?' · '+esc(t.nuProduct==='cuenta_nu'?'Cuenta Nu':'Tarjeta Nu'):'')+(t.importedFrom?' · Importado de extracto':'')+(p?' · <span class="warn">Pendiente</span>':'')+'</small></div><b class="amt '+(inc||refund?'ok':neutral?'nu-neutral':'')+'">'+(neutral?'':sign)+fmt(t.amount)+'</b>'+(act?(!neutral&&t.type!=='anulada'&&p?'<button class="g" data-a="pay" data-id="'+esc(t.id)+'">'+(inc?'Recibido':'Pagado')+'</button>':'')+'<button class="g ic-b" type="button" data-a="delTx" data-id="'+esc(t.id)+'" aria-label="Eliminar movimiento: '+esc(t.name)+'">'+ico('x',15)+'</button>':'')+'</div>'};
/* [clave, nombre en el menú, título de la página, icono]. «ins» se conserva como alias de Informes › Tendencias. */
const TABS=[['dash','Inicio','Hoy en tu centro','home'],['mov','Dinero','Dinero','wallet'],['dia','Mi día','Mi día','check'],['metas','Metas','Metas','target'],['turnos','Turnos','Turnos','clock'],['inf','Informes','Informes','chart'],['cuenta','Cuenta','Cuenta y copias','user']];
const MOBILE_MAIN=['dash','mov','dia'],MOBILE_MORE=['turnos','metas','inf','cuenta'];
function navButton([k,n,,i]){return `<button type="button" class="${tab===k?'on':''}" data-t="${k}" ${tab===k?'aria-current="page"':''}>${ico(i,19)}<span>${n}</span></button>`}
function nav(){
  document.getElementById('nav').innerHTML=TABS.map(navButton).join('');
  const T=k=>TABS.find(x=>x[0]===k),moreOn=MOBILE_MORE.includes(tab);
  document.getElementById('tabbarItems').innerHTML=navButton(T('dash'))+navButton(T('mov'))+
    `<button type="button" class="tab-add" data-quick aria-label="Registrar movimiento">${ico('plus',24)}</button>`+navButton(T('dia'))+
    `<button type="button" class="${moreOn?'on':''}" data-more ${moreOn?'aria-current="page"':''} aria-haspopup="dialog">${ico('more',19)}<span>${moreOn?esc(T(tab)[1]):'Más'}</span></button>`;
  document.getElementById('moreList').innerHTML=MOBILE_MORE.map(k=>{const [,n,,i]=T(k);return `<button type="button" class="more-item ${tab===k?'on':''}" data-t="${k}">${ico(i,20)}<span>${n}</span>${ico('right',16)}</button>`}).join('')+
    `<button type="button" class="more-item" data-theme-toggle>${ico('moon',20)}<span>Cambiar tema</span></button>`;
}
function goTab(k){if(k==='ins'){k='inf';window._reportView='tendencias'}if(!TABS.some(x=>x[0]===k))k='dash';tab=k;E=null;render();scrollTo(0,0);document.querySelector('#app h1')?.focus({preventScroll:true})}
function closeSheets(){document.querySelectorAll('dialog.sheet[open]').forEach(d=>d.close())}
function toggleTheme(){const r=document.documentElement,n=effectiveTheme()==='dark'?'light':'dark';r.dataset.theme=n;syncBrowserThemeColor();try{localStorage.setItem('mcc-theme',n)}catch(e){}}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-t]');if(t&&(t.closest('#nav')||t.closest('#tabbar')||t.closest('#moreSheet'))){sfx('tap');closeSheets();goTab(t.dataset.t);return}
  if(e.target.closest('[data-more]')){sfx('open');document.getElementById('moreSheet').showModal();return}
  if(e.target.closest('[data-quick]')||e.target.closest('#quickOpen')){sfx('open');openQuickAdd();return}
  if(e.target.closest('[data-theme-toggle]')){sfx('tap');animatedThemeToggle(e);return}
  if(e.target.closest('dialog.sheet [data-close]')){closeSheets();return}
  const go=e.target.closest('dialog.sheet [data-go]');if(go){closeSheets();goTab(go.dataset.go);return}
  /* Tocar fuera del contenido de una hoja la cierra. */
  if(e.target.matches('dialog.sheet[open]'))e.target.close();
});
/* ---- Registrar movimiento rápido (mismo flujo que el formulario de Dinero) ---- */
function openQuickAdd(){
  const d=document.getElementById('quickAdd'),f=document.getElementById('fQuick');
  f.reset();f.date.value=hoy();
  document.getElementById('quickCats').innerHTML=[...new Set([...CATS,...S.tx.map(t=>t.cat).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'es-CO')).map(c=>'<option value="'+esc(c)+'">').join('');
  d.querySelector('[data-close]').innerHTML=ico('x',16);
  d.showModal();setTimeout(()=>f.amount.focus(),50);
}
document.getElementById('fQuick').addEventListener('submit',e=>{
  e.preventDefault();const v=Object.fromEntries(new FormData(e.target));
  const alertMsg=addTransaction(v);closeSheets();save();render();sfx('money');toast(alertMsg||'Movimiento guardado');
});
function render(){
  if(tab==='ins'){tab='inf';window._reportView='tendencias'}
  document.getElementById('fecha').textContent=fechaLarga(hoy());
  nav();
  const T=TABS.find(x=>x[0]===tab)||TABS[0];
  document.getElementById('cloudPanel').hidden=tab!=='cuenta';
  document.body.dataset.tab=tab;
  const a=document.getElementById('app');
  const views={dash:vDash,mov:vMov,dia:vDia,metas:vMetas,turnos:vTurnos,inf:vReports,cuenta:()=>''};
  a.innerHTML=`<div class="ph"><h1 tabindex="-1">${T[2]}</h1>${tab==='dash'?`<p>${esc(fechaLarga(hoy()))}</p>`:''}</div>`+views[tab]();
  animateEnter(a);requestAnimationFrame(placeIndicators);
  document.dispatchEvent(new Event('mcc:rendered'));
}
document.querySelectorAll('dialog.sheet [data-close]').forEach(b=>b.innerHTML=ico('x',16));
