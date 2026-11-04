/* ---- Gym · mapa anatómico (SVG propio, sin imágenes externas) ----
   Vista frontal y posterior. Cada región tiene data-muscle con el id de gym-muscles.js, es enfocable
   con teclado y se colorea según la banda de estímulo. Coordenadas del lado izquierdo de la figura;
   el derecho se genera en espejo (x → 200 − x). Estilizado: no es una lámina médica. */
const GYM_MAP_SHAPES={
  front:{
    /* Silueta neutra: [puntos del lado izquierdo, espejar]. La cabeza se dibuja aparte. */
    silhouette:[
      [[91,50],[109,50],[109,64],[91,64]],
      [[100,62],[76,63],[62,70],[58,80],[64,120],[68,172],[100,176]],
      [[62,70],[52,78],[48,140],[42,182],[44,200],[58,202],[64,182],[72,142],[74,96]],
      [[100,174],[70,172],[68,200],[70,262],[72,280],[72,330],[76,376],[74,384],[94,384],[94,330],[98,280],[100,230]]
    ],
    muscles:[
      ['trapecio',[[93,55],[78,66],[96,67]],true],
      ['deltoide_anterior',[[78,66],[66,72],[63,90],[70,96],[76,84],[80,70]],true],
      ['deltoide_lateral',[[66,72],[57,79],[56,97],[62,100],[63,90]],true],
      ['pectoral_mayor',[[98,70],[81,70],[76,84],[72,100],[82,108],[98,106]],true],
      ['biceps',[[71,100],[61,104],[57,130],[62,140],[70,134],[73,112]],true],
      ['braquial',[[57,130],[54,140],[59,147],[62,140]],true],
      ['antebrazos',[[55,147],[48,176],[49,196],[57,198],[63,176],[64,149]],true],
      ['recto_abdominal',[[87,110],[113,110],[112,168],[100,175],[88,168]],false],
      ['oblicuos',[[83,110],[75,112],[73,150],[80,170],[88,168],[86,111]],true],
      ['cuadriceps',[[77,186],[71,222],[74,262],[84,274],[93,262],[96,224],[92,191]],true],
      ['aductores',[[93,192],[97,224],[99,242],[99,193]],true]
    ]
  },
  back:{
    silhouette:null,
    muscles:[
      ['trapecio',[[100,54],[84,62],[72,68],[86,74],[96,79],[100,120],[104,79],[114,74],[128,68],[116,62]],false],
      ['deltoide_posterior',[[72,68],[61,74],[57,93],[64,98],[70,86],[80,74]],true],
      ['deltoide_lateral',[[61,74],[55,82],[55,96],[57,93]],true],
      ['romboides',[[95,82],[85,78],[81,96],[94,104]],true],
      ['dorsal_ancho',[[81,98],[70,98],[68,120],[78,150],[92,154],[95,108]],true],
      ['erectores',[[95,122],[89,154],[91,172],[98,172],[99,124]],true],
      ['triceps',[[64,99],[57,101],[55,134],[60,144],[68,136],[70,105]],true],
      ['antebrazos',[[55,147],[48,176],[49,196],[57,198],[63,176],[64,149]],true],
      ['gluteos',[[78,174],[74,196],[82,212],[98,210],[99,175]],true],
      ['isquiotibiales',[[76,215],[74,252],[80,272],[92,272],[95,248],[96,215]],true],
      ['aductores',[[96,215],[95,246],[99,250],[99,215]],true],
      ['gemelos',[[78,282],[74,306],[80,326],[88,322],[92,300],[92,282]],true],
      ['soleo',[[80,327],[78,350],[84,372],[90,372],[92,346],[88,323]],true]
    ]
  }
};
GYM_MAP_SHAPES.back.silhouette=GYM_MAP_SHAPES.front.silhouette;
const gymPts=(pts,mirror)=>pts.map(([x,y])=>`${mirror?200-x:x},${y}`).join(' ');

/* stats: resultado de gymMuscleStats; scale: factor para pasar a «por semana»; selected: id. */
function gymBodyMapSvg(view,stats,{scale=1,selected=null}={}){
  const V=GYM_MAP_SHAPES[view],label=view==='front'?'Vista frontal':'Vista posterior';
  const sil=`<ellipse cx="100" cy="30" rx="18" ry="22" class="bm-sil"/>`+V.silhouette.map(p=>`<polygon class="bm-sil" points="${gymPts(p,false)}"/><polygon class="bm-sil" points="${gymPts(p,true)}"/>`).join('');
  const regions=V.muscles.map(([id,pts,mirror])=>{
    const st=stats?.[id],band=st?gymStimulusBand(st.weightedSets*scale):0,m=GYM_MUSCLES_BY_ID[id];
    const title=`${m.name}: ${st?st.weightedSets+' series ponderadas':'sin datos'}`;
    const attrs=`class="bm-m bm-b${band} ${selected===id?'is-sel':''}" data-muscle="${id}" tabindex="0" role="button" aria-label="${title}" aria-pressed="${selected===id}"`;
    const poly=p=>`<polygon points="${p}"/>`;
    return `<g ${attrs}><title>${title}</title>${poly(gymPts(pts,false))}${mirror?poly(gymPts(pts,true)):''}</g>`;
  }).join('');
  return `<figure class="bm-fig"><svg class="bm-svg" viewBox="30 0 140 385" role="group" aria-label="${label}: grupos musculares">${sil}${regions}</svg><figcaption>${label}</figcaption></figure>`;
}
