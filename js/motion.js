/* ---- Movimiento ----
   Entrada escalonada al cambiar de sección (desenfoque → nítido), indicador deslizante del menú,
   contadores animados y anillos de progreso. Todo se desactiva si el sistema pide reducir movimiento. */
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut=t=>1-Math.pow(1-t,3);
/* Anillo de progreso (SVG) con el porcentaje en el centro. */
function ringSvg(pct,size=64,stroke=7){
  const r=(size-stroke)/2,c=2*Math.PI*r,p=Math.max(0,Math.min(100,pct));
  return `<span class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="ring-bg" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}"/><circle class="ring-fg" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c*(1-p/100)).toFixed(2)}" style="--c:${c.toFixed(2)}" transform="rotate(-90 ${size/2} ${size/2})"/></svg><b data-count="${Math.round(p)}" data-format="pct">${Math.round(p)}%</b></span>`;
}
/* Cuenta desde 0 hasta el valor final de cada [data-count]. */
function countUp(root){
  if(reduceMotion())return;
  root.querySelectorAll('[data-count]').forEach(el=>{
    const to=Number(el.dataset.count),pct=el.dataset.format==='pct';if(!Number.isFinite(to))return;
    const final=el.textContent,start=performance.now(),dur=pct?900:800;
    const step=now=>{const k=Math.min(1,(now-start)/dur),v=to*easeOut(k);el.textContent=pct?Math.round(v)+'%':fmt(v);if(k<1)requestAnimationFrame(step);else el.textContent=final};
    requestAnimationFrame(step);
  });
}
/* Animación de entrada de la sección. Solo al cambiar de pestaña, no en cada guardado. */
let _lastEnteredTab=null;
function animateEnter(app){
  const changed=_lastEnteredTab!==tab;_lastEnteredTab=tab;
  if(!changed||reduceMotion())return;
  app.classList.remove('stagger');void app.offsetWidth;
  [...app.children].forEach((el,i)=>el.style.setProperty('--i',Math.min(i,8)));
  app.classList.add('stagger');countUp(app);
  clearTimeout(animateEnter._t);animateEnter._t=setTimeout(()=>app.classList.remove('stagger'),1600);
}
/* Indicadores que se deslizan hasta la sección activa (menú lateral y barra inferior). */
function placeIndicators(){
  const on=document.querySelector('#nav button.on'),ind=document.querySelector('.nav-ind');
  if(ind){if(on){ind.style.transform=`translateY(${on.offsetTop}px)`;ind.style.height=on.offsetHeight+'px';ind.style.opacity='1'}else ind.style.opacity='0'}
  const bar=document.getElementById('tabbar'),tb=bar&&bar.querySelector('#tabbarItems button.on'),ti=bar&&bar.querySelector('.tab-ind');
  if(ti){if(tb&&getComputedStyle(bar).display!=='none'){const r=tb.getBoundingClientRect(),p=bar.getBoundingClientRect();ti.style.transform=`translateX(${(r.left-p.left+r.width/2-ti.offsetWidth/2).toFixed(1)}px)`;ti.style.opacity='1'}else ti.style.opacity='0'}
}
addEventListener('resize',()=>requestAnimationFrame(placeIndicators));
/* Cambio de tema con revelado circular desde el botón (si el navegador lo permite). */
function animatedThemeToggle(ev){
  const go=()=>toggleTheme();
  if(!document.startViewTransition||reduceMotion()){go();return}
  const x=ev?.clientX??innerWidth/2,y=ev?.clientY??0,r=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
  const vt=document.startViewTransition(go);
  vt.ready.then(()=>document.documentElement.animate({clipPath:[`circle(0 at ${x}px ${y}px)`,`circle(${r}px at ${x}px ${y}px)`]},{duration:520,easing:'cubic-bezier(.2,.8,.2,1)',pseudoElement:'::view-transition-new(root)'})).catch(()=>{});
}
