/* ---- Gym Intelligence · historial y proyecciones (fase H): interfaz ----
   Pestaña Historial: rango de 7 días a 12 meses, gráficos de peso y 1RM con proyección a 4 semanas e
   intervalo del 95 %, y tabla por periodo. Utilidades de gym.js solo dentro de funciones. */
let gHistRange='90d',gHistEx=null;
const ghN=(x,d=1)=>(Math.round((+x||0)*10**d)/10**d).toLocaleString('es-CO',{maximumFractionDigits:d});

/* Gráfico SVG: puntos reales, tendencia y banda de proyección. */
function ghChart(series,proj,{unit='kg',label}){
  if(series.length<2)return '<div class="empty">Hacen falta al menos dos registros para dibujar la evolución.</div>';
  const w=620,h=220,l=52,r=16,t=14,b=30,pw=w-l-r,ph=h-t-b;
  const first=series[0].date,lastD=proj&&proj.enough?proj.target.date:series[series.length-1].date;
  const dx=d=>(Date.parse(d+'T12:00:00Z')-Date.parse(first+'T12:00:00Z'))/864e5,span=Math.max(1,dx(lastD));
  const vals=series.map(p=>p.value).concat(proj&&proj.enough?proj.band.flatMap(x=>[x.lo,x.hi]).concat([proj.fitStart]):[]);
  let lo=Math.min(...vals),hi=Math.max(...vals);const pad=(hi-lo||1)*0.12;lo-=pad;hi+=pad;
  const X=d=>l+dx(d)/span*pw,Y=v=>t+ph-(v-lo)/(hi-lo)*ph;
  const grid=[lo,(lo+hi)/2,hi].map(v=>`<line x1="${l}" x2="${w-r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${l-6}" y="${Y(v)+4}" text-anchor="end" font-size="10" fill="var(--muted)">${ghN(v)}</text>`).join('');
  let extra='';
  if(proj&&proj.enough){
    const bd=proj.band,lastReal=series[series.length-1].date;
    extra+=`<polygon class="gh-band" points="${bd.map(p=>X(p.date)+','+Y(p.hi)).join(' ')} ${[...bd].reverse().map(p=>X(p.date)+','+Y(p.lo)).join(' ')}"/>`;
    extra+=`<line class="gh-fit" x1="${X(proj.first)}" y1="${Y(proj.fitStart)}" x2="${X(lastReal)}" y2="${Y(proj.fitNow)}"/>`;
    extra+=`<line class="gh-proj" x1="${X(lastReal)}" y1="${Y(proj.fitNow)}" x2="${X(proj.target.date)}" y2="${Y(proj.target.value)}"/>`;
    extra+=`<line x1="${X(lastReal)}" x2="${X(lastReal)}" y1="${t}" y2="${t+ph}" stroke="var(--line-strong)" stroke-dasharray="3 3"/><text x="${X(lastReal)+4}" y="${t+10}" font-size="10" fill="var(--muted)">hoy</text>`;
  }
  const line=`<polyline points="${series.map(p=>X(p.date)+','+Y(p.value)).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>`;
  const dots=series.map(p=>`<circle cx="${X(p.date)}" cy="${Y(p.value)}" r="3.5" fill="var(--accent)"><title>${gesc(fshort(p.date))}: ${ghN(p.value)} ${unit}</title></circle>`).join('');
  return `<svg class="insight-svg gh-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${gesc(label)}">${grid}${extra}${line}${dots}<text x="${l}" y="${h-8}" font-size="10" fill="var(--muted)">${gesc(fshort(first))}</text><text x="${w-r}" y="${h-8}" text-anchor="end" font-size="10" fill="var(--muted)">${gesc(fshort(lastD))}</text></svg>`;
}
function ghProjText(p,unit,what){
  if(!p.enough)return `<p class="k gh-nobase">${gico('info',14)} ${gesc(p.reason)}</p>`;
  return `<p class="gh-proj-txt">Tendencia: <b>${p.perWeek>0?'+':''}${ghN(p.perWeek,2)} ${unit}/semana</b> (${p.n} registros en ${p.span} días). Si sigue así, el ${gesc(fshort(p.target.date))} ${what} estaría entre <b>${ghN(p.target.lo)} y ${ghN(p.target.hi)} ${unit}</b> (95 %).</p>
    <p class="k">Proyección lineal de la tendencia actual, no una predicción garantizada. El intervalo crece cuanto más lejos se mira.</p>`;
}

function vHistorial(){
  const gate=needAccount('tu historial');if(gate)return gate;
  const today=gymToday(),[rangeLabel,days]=GH_RANGES[gHistRange],from=gymAddDays(today,-(days-1));
  const seg=`<div class="seg gh-seg" role="group" aria-label="Periodo">${Object.entries(GH_RANGES).map(([k,[n]])=>`<label><input type="radio" name="histRange" value="${k}" ${k===gHistRange?'checked':''}><span>${n}</span></label>`).join('')}</div>`;
  // Peso
  const ws=gymWeightSeries(GS.metrics,from,today),wp=gymProjection(ws,{horizon:28});
  const weight=`<section class="card"><h2>Peso corporal</h2>${ghChart(ws,wp,{unit:'kg',label:'Peso corporal y proyección'})}${ws.length?ghProjText(wp,'kg','tu peso'):'<p class="k">Sin mediciones en este periodo.</p>'}</section>`;
  // Fuerza
  const exIds=[...new Set(GS.sets.map(s=>s.exercise_id))].filter(id=>gymE1rmSeries(id,GS.sessions,GS.sets,from,today).length);
  if(!gHistEx||!exIds.includes(gHistEx))gHistEx=exIds[0]||null;
  let strength='<div class="empty">Sin series de 1 a 12 repeticiones con peso en este periodo.</div>';
  if(gHistEx){const es=gymE1rmSeries(gHistEx,GS.sessions,GS.sets,from,today),ep=gymProjection(es,{horizon:28});
    strength=`<label class="fl">Ejercicio<select id="histEx">${exIds.map(id=>`<option value="${gesc(id)}" ${id===gHistEx?'selected':''}>${gesc(exName(id))}</option>`).join('')}</select></label>${ghChart(es,ep,{unit:'kg',label:'1RM estimado y proyección'})}${ghProjText(ep,'kg','tu 1RM estimado')}`}
  // Tabla
  const rows=gymHistorySummary({sessions:GS.sessions,sets:GS.sets,foods:GS.foods,recovery:GS.recovery,metrics:GS.metrics,from,to:today,daily:days<=7}).reverse();
  const any=rows.some(r=>r.sessions||r.loggedDays||r.sleepN||r.weightN);
  const cell=(v,f)=>v===null||v===0&&f!=='n'?'<span class="k">—</span>':f==='n'?v:f(v);
  const table=any?`<div class="gh-table-wrap"><table class="gh-table"><thead><tr><th>${days<=7?'Día':'Semana'}</th><th>Entrenos</th><th>Volumen</th><th>Kcal media</th><th>Proteína</th><th>Sueño</th><th>Peso</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td>${gesc(fshort(r.period))}</td><td>${r.sessions||'<span class="k">—</span>'}</td><td>${cell(r.volume,v=>ghN(v/1000,1)+' t')}</td><td>${cell(r.kcalAvg,v=>ghN(v,0)+(r.loggedDays?` <small class="k">(${r.loggedDays} d)</small>`:''))}</td><td>${cell(r.proteinAvg,v=>ghN(v,0)+' g')}</td><td>${cell(r.sleepAvg,v=>ghN(v)+' h')}</td><td>${cell(r.weightAvg,v=>ghN(v)+' kg')}</td></tr>`).join('')}</tbody></table></div>
    <p class="k">Las medias de calorías, proteína y sueño solo cuentan los días con registro (entre paréntesis).</p>`:'<div class="empty">Sin registros en este periodo.</div>';
  // Los datos de nutrición y recuperación cargados cubren 35 y 90 días: se avisa si el rango es mayor.
  const note=days>35?`<p class="k">Nutrición: se muestran los registros cargados desde ${gesc(fshort(GS.nutriFrom||gymAddDays(today,-34)))}.${days>90?' Recuperación: últimos 90 días.':''}</p>`:'';
  return `<section class="card gh-head"><h2>Periodo: ${gesc(rangeLabel)}</h2>${seg}<p class="k">Las proyecciones solo aparecen con al menos ${GH_MIN_N} registros en ${GH_MIN_SPAN/7} semanas; nunca se proyecta masa muscular ni % de grasa.</p></section>
    <div class="cols">${weight}<section class="card"><h2>Fuerza estimada (1RM)</h2>${strength}</section></div>
    <section class="card"><h2>Resumen por ${days<=7?'día':'semana'}</h2>${table}${note}</section>`;
}
document.addEventListener('change',async e=>{
  const t=e.target;
  if(t.name==='histRange'){gHistRange=t.value;const days=GH_RANGES[gHistRange][1];if(days>35&&typeof gymLoadNutrition==='function'&&GS.nutriSchema){const from=gymAddDays(gymToday(),-(days-1));if(!GS.nutriFrom||from<GS.nutriFrom)await gymLoadNutrition(from,gymAddDays(GS.nutriFrom||gymToday(),-1))}gRender(false);return}
  if(t.id==='histEx'){gHistEx=t.value;gRender(false)}
});
