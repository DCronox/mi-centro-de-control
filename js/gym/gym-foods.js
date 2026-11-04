/* ---- Gym Intelligence · alimentos (fase D1): funciones puras ----
   - Escalado de porciones de un alimento (propio o reciente) a la cantidad registrada.
   - Analizador de texto en español: «2 huevos, una arepa con queso y un vaso de jugo».
   - Búsqueda aproximada entre los alimentos conocidos de la persona.
   No contiene valores nutricionales: los datos salen de lo que la persona registra (y, en D2, de USDA). */

const GF_NUM_WORDS={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,media:0.5,medio:0.5,'un par de':2,'par de':2,'una docena de':12};
/* Unidades caseras. `ml`/`g` solo cuando la equivalencia es una medida estándar, no un peso de alimento. */
const GF_UNITS=[
  ['g',['g','gr','grs','gramo','gramos'],{g:1}],['kg',['kg','kilo','kilos','kilogramo','kilogramos'],{g:1000}],
  ['ml',['ml','mililitro','mililitros'],{ml:1}],['l',['l','lt','litro','litros'],{ml:1000}],
  ['taza',['taza','tazas','pocillo','pocillos'],{ml:240}],['vaso',['vaso','vasos'],{ml:240}],
  ['cucharada',['cucharada','cucharadas','cda','cdas'],{ml:15}],['cucharadita',['cucharadita','cucharaditas','cdta','cdtas'],{ml:5}],
  ['unidad',['unidad','unidades','und','u','pieza','piezas']],['porción',['porcion','porciones','porción','racion','raciones','ración']],
  ['plato',['plato','platos']],['tajada',['tajada','tajadas','rebanada','rebanadas','rodaja','rodajas']],
  ['lata',['lata','latas']],['botella',['botella','botellas']],['paquete',['paquete','paquetes','bolsa','bolsas']],
  ['scoop',['scoop','scoops','medida','medidas','cazo','cazos']]
];
const GF_UNIT_MAP=new Map();GF_UNITS.forEach(([k,alias])=>alias.forEach(a=>GF_UNIT_MAP.set(gfNorm(a),k)));
const GF_UNIT_STD=Object.fromEntries(GF_UNITS.map(([k,,std])=>[k,std||null]));
const GF_SIZES={pequeño:'pequeño',pequeña:'pequeño',pequeños:'pequeño',pequeñas:'pequeño',chico:'pequeño',chica:'pequeño',mediano:'mediano',mediana:'mediano',grande:'grande',grandes:'grande'};
const GF_SIZE_MAP=new Map(Object.entries(GF_SIZES).map(([k,v])=>[gfNorm(k),v]));
const GF_STOP=new Set(['de','del','la','el','los','las','con','y','en','al','a','un','una','unos','unas','mi','para']);

function gfNorm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9ñ\s.,/]/g,' ').replace(/\s+/g,' ').trim()}
const gfStem=w=>w.length>4&&w.endsWith('es')?w.slice(0,-2):w.length>3&&w.endsWith('s')?w.slice(0,-1):w;
function gfTokens(s){return gfNorm(s).split(' ').filter(w=>w&&!GF_STOP.has(w)&&!/^\d/.test(w)).map(gfStem)}
function gfUnitKey(u){return GF_UNIT_MAP.get(gfNorm(u))||null}

/* Convierte cantidad+unidad a gramos o ml cuando es posible, con la equivalencia propia del alimento si existe. */
function gfToBase(qty,unit,food){
  const std=GF_UNIT_STD[unit];
  if(std&&std.g)return{g:qty*std.g};
  if(std&&std.ml)return{ml:qty*std.ml};
  if(food&&food.grams_per_serving&&unit===food.serving_unit)return{g:qty/(+food.serving_qty||1)*food.grams_per_serving};
  return null;
}

/* Nutrientes de un alimento para una cantidad. Devuelve null si no hay forma honesta de convertir la unidad. */
function gymScaleFood(food,qty,unit){
  const q=+qty;if(!(q>0))return null;
  const sq=+food.serving_qty||1,su=food.serving_unit||'porción';
  let factor=null;
  if(unit===su)factor=q/sq;
  else{
    const a=gfToBase(q,unit,food),b=gfToBase(sq,su,food);
    if(a&&b&&a.g!==undefined&&b.g!==undefined)factor=a.g/b.g;
    else if(a&&b&&a.ml!==undefined&&b.ml!==undefined)factor=a.ml/b.ml;
  }
  if(factor===null||!isFinite(factor))return null;
  const r=x=>Math.round((+x||0)*factor*10)/10;
  return{kcal:Math.round((+food.kcal||0)*factor),protein_g:r(food.protein_g),carbs_g:r(food.carbs_g),fat_g:r(food.fat_g),fiber_g:r(food.fiber_g),factor:Math.round(factor*1000)/1000};
}

/* Divide un texto en elementos. «con» NO separa (arepa con queso es un solo alimento). */
function gfSplit(text){
  return String(text||'').replace(/\n/g,',').split(/\s*[,;+]\s*|\s+(?:y|e|más|mas|además|ademas)\s+/i).map(s=>s.trim()).filter(Boolean);
}
function gfParseNumber(tok){
  if(/^\d+([.,]\d+)?$/.test(tok))return parseFloat(tok.replace(',','.'));
  const f=tok.match(/^(\d+)\/(\d+)$/);if(f&&+f[2])return +f[1]/+f[2];
  return null;
}

/* Analiza un elemento: cantidad, unidad, tamaño y texto del alimento. */
function gymParseItem(raw){
  let s=gfNorm(raw).replace(/(\d)\s*(g|gr|kg|ml|l)\b/g,'$1 $2');
  let qty=null,qtyExplicit=false,unit=null,size=null;
  for(const w of Object.keys(GF_NUM_WORDS).sort((a,b)=>b.length-a.length)){
    if(s===w||s.startsWith(w+' ')){qty=GF_NUM_WORDS[w];qtyExplicit=true;s=s.slice(w.length).trim();break}
  }
  let words=s.split(' ').filter(Boolean);
  if(qty===null&&words.length&&gfParseNumber(words[0])!==null){qty=gfParseNumber(words.shift());qtyExplicit=true;
    if(words[0]==='y'&&words[1]&&/^(medio|media)$/.test(words[1])){qty+=0.5;words.splice(0,2)}}
  if(words.length&&/^(medio|media)$/.test(words[0])&&qty!==null){qty+=0.5;words.shift()}
  if(words.length&&gfUnitKey(words[0])){unit=gfUnitKey(words.shift());if(words[0]==='de')words.shift()}
  words=words.filter(w=>{if(GF_SIZE_MAP.has(w)){size=GF_SIZE_MAP.get(w);return false}return true});
  const food=words.join(' ').replace(/^de /,'').trim();
  return{raw:String(raw).trim(),qty:qty===null?1:qty,qtyExplicit,unit,size,food};
}
function gymParseMeal(text){return gfSplit(text).map(gymParseItem).filter(i=>i.food)}

/* Similitud entre el texto escrito y un alimento conocido (0–1). */
function gfScore(query,cand){
  const q=gfTokens(query),c=gfTokens(cand);if(!q.length||!c.length)return 0;
  const cs=new Set(c);let hit=0;q.forEach(t=>{if(cs.has(t))hit++;else if(c.some(x=>x.length>3&&t.length>3&&(x.startsWith(t)||t.startsWith(x))))hit+=0.7});
  const recall=hit/q.length,precision=hit/c.length;
  const exact=gfNorm(query)===gfNorm(cand)?0.15:0;
  return Math.min(1,0.65*recall+0.35*precision+exact);
}
/* Mejores coincidencias entre los alimentos conocidos (propios y recientes). */
function gymMatchFood(query,known,{limit=5,min=0.45}={}){
  return(known||[]).map(k=>({food:k,score:Math.max(gfScore(query,k.name),...(k.aliases||[]).map(a=>gfScore(query,a)))}))
    .filter(x=>x.score>=min).sort((a,b)=>b.score-a.score||(b.food.uses||0)-(a.food.uses||0)).slice(0,limit);
}

/* Alimentos «recientes» a partir del historial de registros: uno por nombre, con su porción tal como se registró. */
function gymRecentFoods(logs,{limit=40}={}){
  const by=new Map();
  for(const l of [...(logs||[])].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))){
    const k=gfNorm(l.name);if(!k)continue;const e=by.get(k);
    if(e){e.uses++;continue}
    const qty=+l.quantity>0?+l.quantity:1,unit=gfUnitKey(l.unit||'')||(l.unit?String(l.unit):'porción');
    by.set(k,{kind:'recent',id:'recent:'+k,name:l.name,serving_qty:qty,serving_unit:unit,grams_per_serving:+l.grams>0?+l.grams:null,
      kcal:+l.kcal||0,protein_g:+l.protein_g||0,carbs_g:+l.carbs_g||0,fat_g:+l.fat_g||0,fiber_g:+l.fiber_g||0,estimated:!!l.estimated,uses:1,last:l.date});
  }
  return [...by.values()].sort((a,b)=>b.uses-a.uses||String(b.last).localeCompare(String(a.last))).slice(0,limit);
}
/* Alimento propio (tabla food_custom) en el mismo formato. */
function gymCustomAsKnown(c){return{kind:'custom',id:c.id,name:c.name,aliases:c.aliases||[],serving_qty:+c.serving_qty||1,serving_unit:c.serving_unit||'porción',grams_per_serving:c.grams_per_serving===null||c.grams_per_serving===undefined?null:+c.grams_per_serving,
  kcal:+c.kcal||0,protein_g:+c.protein_g||0,carbs_g:+c.carbs_g||0,fat_g:+c.fat_g||0,fiber_g:+c.fiber_g||0,estimated:false,uses:0}}

/* Propuesta para un elemento del texto: alimento elegido, nutrientes y si es estimado o falta dato. */
function gymProposeItem(item,known){
  const matches=gymMatchFood(item.food,known);
  const best=matches[0]||null;
  const unit=item.unit||(best?best.food.serving_unit:'porción');
  const out={...item,unit,matches,choice:best?best.food.id:null,nutrients:null,status:'nomatch',notes:[]};
  if(!best)return out;
  const n=gymScaleFood(best.food,item.qty,unit);
  if(!n){out.status='unit';out.notes.push(`No sé convertir «${unit}» para ${best.food.name}; cambia la unidad o escribe los gramos.`);return out}
  out.nutrients=n;out.status=best.score<0.75||item.size||!item.qtyExplicit||best.food.estimated?'estimated':'ok';
  if(best.score<0.75)out.notes.push(`Coincidencia aproximada con «${best.food.name}».`);
  if(item.size)out.notes.push(`Tamaño «${item.size}» no ajustado: revisa la cantidad.`);
  if(!item.qtyExplicit)out.notes.push('No indicaste cantidad: se supone 1.');
  return out;
}

if(typeof module!=='undefined')module.exports={gfNorm,gfTokens,gfSplit,gfUnitKey,gymScaleFood,gymParseItem,gymParseMeal,gfScore,gymMatchFood,gymRecentFoods,gymCustomAsKnown,gymProposeItem};
