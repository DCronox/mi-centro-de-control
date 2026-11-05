/* ---- USDA FoodData Central: normalización y traducción de búsquedas (fase D2) ----
   Se usa en la función Edge `food-search` y en las pruebas de Node. Sin red: solo transforma datos.
   Fuente: https://fdc.nal.usda.gov (datos de dominio público, CC0). Valores por 100 g en Foundation y SR Legacy. */

/* Ids de nutrientes de FDC. Energía: kcal (1008); si falta, factores de Atwater (2047/2048) o kJ (1062). */
const N = { kcal: 1008, kcalAtwaterGen: 2047, kcalAtwaterSpec: 2048, kj: 1062, protein: 1003, fat: 1004, carbs: 1005, carbsSum: 1050, fiber: 1079 };

const r1 = (x) => Math.round((+x || 0) * 10) / 10;

/* Admite los dos formatos de FDC: búsqueda ({nutrientId,value}) y detalle ({nutrient:{id},amount}). */
function nutrientMap(list) {
  const m = new Map();
  for (const n of list || []) {
    const id = n.nutrientId ?? n.nutrient?.id;
    const v = n.value ?? n.amount;
    if (id !== undefined && v !== undefined && v !== null && !m.has(+id)) m.set(+id, +v);
  }
  return m;
}

export function usdaNutrients(food) {
  const m = nutrientMap(food.foodNutrients);
  let kcal = m.get(N.kcal), energySource = 'kcal';
  if (kcal === undefined && m.has(N.kcalAtwaterSpec)) { kcal = m.get(N.kcalAtwaterSpec); energySource = 'atwater_specific'; }
  if (kcal === undefined && m.has(N.kcalAtwaterGen)) { kcal = m.get(N.kcalAtwaterGen); energySource = 'atwater_general'; }
  if (kcal === undefined && m.has(N.kj)) { kcal = m.get(N.kj) / 4.184; energySource = 'kj'; }
  const carbs = m.get(N.carbs) ?? m.get(N.carbsSum);
  const complete = kcal !== undefined && m.has(N.protein) && m.has(N.fat) && carbs !== undefined;
  return { kcal: Math.round(kcal || 0), protein_g: r1(m.get(N.protein)), carbs_g: r1(carbs), fat_g: r1(m.get(N.fat)), fiber_g: r1(m.get(N.fiber)), energySource, complete };
}

/* Porciones caseras del detalle de FDC → [{unit, grams}] con etiqueta legible. */
export function usdaPortions(food) {
  const out = [], seen = new Set();
  for (const p of food.foodPortions || []) {
    const g = +p.gramWeight;
    if (!(g > 0)) continue;
    const unitName = p.measureUnit?.name && !/^(undetermined|RACC)$/i.test(p.measureUnit.name) ? p.measureUnit.name : '';
    const label = [p.amount && p.amount !== 1 ? p.amount : '', unitName, p.modifier || '', !unitName && !p.modifier ? p.portionDescription || '' : '']
      .map((s) => String(s).trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, 60);
    if (!label || /^RACC$/i.test(label)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ unit: label, grams: r1(g / (+p.amount > 0 ? +p.amount : 1)) });
  }
  return out.slice(0, 12);
}

/* Registro normalizado para la tabla food_reference (nutrientes por 100 g). */
export function usdaToRef(food) {
  const n = usdaNutrients(food);
  return {
    source: 'usda', source_id: String(food.fdcId), name_en: String(food.description || '').slice(0, 200),
    data_type: String(food.dataType || '').slice(0, 40), category: String(food.foodCategory?.description || food.foodCategory || '').slice(0, 80),
    kcal: n.kcal, protein_g: n.protein_g, carbs_g: n.carbs_g, fat_g: n.fat_g, fiber_g: n.fiber_g,
    energy_source: n.energySource, complete: n.complete, portions: usdaPortions(food),
    published: String(food.publicationDate || food.publishedDate || '').slice(0, 20),
  };
}

/* Vocabulario español → inglés para buscar en FDC (solo palabras, ningún dato nutricional). */
const ES_EN = {
  huevo: 'egg', clara: 'egg white', yema: 'egg yolk', arroz: 'rice', pollo: 'chicken', pechuga: 'breast', muslo: 'thigh', carne: 'beef', res: 'beef',
  cerdo: 'pork', lomo: 'loin', pescado: 'fish', atun: 'tuna', salmon: 'salmon', tilapia: 'tilapia', camaron: 'shrimp', pavo: 'turkey', jamon: 'ham',
  salchicha: 'sausage', tocino: 'bacon', chorizo: 'chorizo', leche: 'milk', descremada: 'nonfat', deslactosada: 'lactose free', queso: 'cheese',
  yogur: 'yogurt', yogurt: 'yogurt', kumis: 'kefir', mantequilla: 'butter', crema: 'cream', pan: 'bread', tostada: 'toast', galleta: 'cookie',
  avena: 'oats', granola: 'granola', cereal: 'cereal', pasta: 'pasta', espagueti: 'spaghetti', papa: 'potato', papas: 'potatoes', yuca: 'cassava',
  platano: 'plantain', banano: 'banana', banana: 'banana', manzana: 'apple', pera: 'pear', naranja: 'orange', mandarina: 'tangerine', limon: 'lemon',
  fresa: 'strawberries', mora: 'blackberries', uva: 'grapes', pina: 'pineapple', mango: 'mango', papaya: 'papaya', sandia: 'watermelon', melon: 'melon',
  guayaba: 'guava', maracuya: 'passion fruit', aguacate: 'avocado', tomate: 'tomato', cebolla: 'onion', zanahoria: 'carrot', lechuga: 'lettuce',
  brocoli: 'broccoli', espinaca: 'spinach', pepino: 'cucumber', ahuyama: 'squash', calabaza: 'pumpkin', maiz: 'corn', mazorca: 'corn', arveja: 'peas',
  frijol: 'beans', frijoles: 'beans', lenteja: 'lentils', lentejas: 'lentils', garbanzo: 'chickpeas', garbanzos: 'chickpeas', mani: 'peanuts',
  almendra: 'almonds', nuez: 'walnuts', aceite: 'oil', oliva: 'olive', azucar: 'sugar', miel: 'honey', cafe: 'coffee', te: 'tea', chocolate: 'chocolate',
  jugo: 'juice', gaseosa: 'soft drink', cerveza: 'beer', harina: 'flour', trigo: 'wheat', integral: 'whole wheat', blanco: 'white', blanca: 'white',
  entero: 'whole', entera: 'whole', crudo: 'raw', cruda: 'raw', cocido: 'cooked', cocida: 'cooked', hervido: 'boiled', hervida: 'boiled',
  frito: 'fried', frita: 'fried', asado: 'roasted', asada: 'roasted', horneado: 'baked', horneada: 'baked', plancha: 'grilled', molida: 'ground', molido: 'ground',
  verde: 'green', maduro: 'ripe', madura: 'ripe', seco: 'dried', seca: 'dried', proteina: 'protein', suero: 'whey', polvo: 'powder', mayonesa: 'mayonnaise',
};
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'en', 'al', 'a', 'un', 'una', 'unos', 'unas', 'sin']);

export function normQuery(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}
/* Traduce palabra por palabra; las desconocidas se mantienen (FDC también tiene «arepa», «chorizo»…). */
export function toEnglishQuery(es) {
  const words = normQuery(es).split(' ').filter((w) => w && !STOP.has(w));
  const sing = (w) => (w.length > 4 && w.endsWith('es') && ES_EN[w.slice(0, -2)] ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && ES_EN[w.slice(0, -1)] ? w.slice(0, -1) : w);
  const out = [];
  for (const w of words) { const t = ES_EN[w] || ES_EN[sing(w)] || w; for (const p of t.split(' ')) if (!out.includes(p)) out.push(p); }
  return out.join(' ').slice(0, 80);
}
