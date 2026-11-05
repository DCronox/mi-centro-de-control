import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { usdaNutrients, usdaPortions, usdaToRef, toEnglishQuery, normQuery } from '../supabase/functions/_shared/usda.mjs';

// Respuestas reales de FoodData Central (dominio público), recortadas a los campos que usamos.
const search = JSON.parse(readFileSync(new URL('./fixtures/usda-search.json', import.meta.url)));
const full = JSON.parse(readFileSync(new URL('./fixtures/usda-full.json', import.meta.url)));

test('lee nutrientes por 100 g del formato de búsqueda', () => {
  const egg = usdaNutrients(search.foods[0]);
  assert.deepEqual([egg.kcal, egg.protein_g, egg.fat_g, egg.carbs_g, egg.fiber_g], [143, 12.6, 9.5, 0.7, 0]);
  assert.equal(egg.complete, true);
  assert.equal(egg.energySource, 'kcal');
});

test('lee el formato de detalle y coincide con la búsqueda', () => {
  const a = usdaNutrients(search.foods[0]), b = usdaNutrients(full.find((f) => f.fdcId === 171287));
  assert.deepEqual([a.kcal, a.protein_g, a.fat_g], [b.kcal, b.protein_g, b.fat_g]);
});

test('energía alternativa cuando falta el valor en kcal', () => {
  const kj = usdaNutrients({ foodNutrients: [{ nutrientId: 1062, value: 418.4 }, { nutrientId: 1003, value: 1 }, { nutrientId: 1004, value: 1 }, { nutrientId: 1050, value: 20 }] });
  assert.deepEqual([kj.kcal, kj.energySource, kj.carbs_g, kj.complete], [100, 'kj', 20, true]);
  const at = usdaNutrients({ foodNutrients: [{ nutrientId: 2048, value: 90 }, { nutrientId: 2047, value: 95 }] });
  assert.deepEqual([at.kcal, at.energySource, at.complete], [90, 'atwater_specific', false]);
});

test('porciones caseras con gramos por unidad', () => {
  const egg = usdaPortions(full.find((f) => f.fdcId === 171287));
  assert.deepEqual(egg.find((p) => p.unit === 'large'), { unit: 'large', grams: 50 });
  assert.ok(egg.some((p) => /^cup/.test(p.unit) && p.grams === 243));
  const banana = usdaPortions(full.find((f) => f.fdcId === 1105314));
  assert.deepEqual(banana, [{ unit: 'Banana Peeled', grams: 115 }]); // RACC se descarta
});

test('registro normalizado para food_reference', () => {
  const r = usdaToRef(full.find((f) => f.fdcId === 171287));
  assert.equal(r.source, 'usda'); assert.equal(r.source_id, '171287');
  assert.equal(r.name_en, 'Egg, whole, raw, fresh'); assert.equal(r.kcal, 143);
  assert.ok(r.portions.length >= 5);
});

test('traduce términos de comida del español sin perder palabras desconocidas', () => {
  assert.equal(toEnglishQuery('2 huevos cocidos'), '2 egg cooked');
  assert.equal(toEnglishQuery('Pechuga de pollo a la plancha'), 'breast chicken grilled');
  assert.equal(toEnglishQuery('arroz blanco'), 'rice white');
  assert.equal(toEnglishQuery('arepa de maíz'), 'arepa corn');
  assert.equal(toEnglishQuery('plátano maduro frito'), 'plantain ripe fried');
  assert.equal(normQuery('  Fríjoles ROJOS!! '), 'frijoles rojos');
});
