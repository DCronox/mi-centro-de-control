import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const F = require('../js/gym/gym-foods.js');

// Valores de prueba (no son datos de referencia): solo comprueban la aritmética.
const huevo = { kind: 'custom', id: 'h', name: 'Huevo', serving_qty: 1, serving_unit: 'unidad', grams_per_serving: 50, kcal: 70, protein_g: 6, carbs_g: 0.5, fat_g: 5, fiber_g: 0 };
const avena = { kind: 'custom', id: 'a', name: 'Avena en hojuelas', serving_qty: 100, serving_unit: 'g', kcal: 380, protein_g: 13, carbs_g: 67, fat_g: 7, fiber_g: 10 };
const jugo = { kind: 'custom', id: 'j', name: 'Jugo de naranja', serving_qty: 250, serving_unit: 'ml', kcal: 110, protein_g: 2, carbs_g: 26, fat_g: 0, fiber_g: 0.5 };
const arepa = { kind: 'recent', id: 'recent:arepa con queso', name: 'Arepa con queso', serving_qty: 1, serving_unit: 'unidad', kcal: 269, protein_g: 12, carbs_g: 35, fat_g: 9, fiber_g: 0, uses: 3 };
const known = [huevo, avena, jugo, arepa];

test('separa elementos sin partir «arepa con queso»', () => {
  assert.deepEqual(F.gfSplit('2 huevos, una arepa con queso y un vaso de jugo de naranja'), ['2 huevos', 'una arepa con queso', 'un vaso de jugo de naranja']);
});

test('interpreta cantidades, unidades y tamaños en español', () => {
  const p = F.gymParseItem;
  assert.deepEqual([p('2 huevos').qty, p('2 huevos').unit, p('2 huevos').food], [2, null, 'huevos']);
  assert.deepEqual([p('una arepa con queso').qty, p('una arepa con queso').food], [1, 'arepa con queso']);
  const v = p('un vaso de jugo de naranja'); assert.deepEqual([v.qty, v.unit, v.food], [1, 'vaso', 'jugo de naranja']);
  const g = p('80g de avena'); assert.deepEqual([g.qty, g.unit, g.food], [80, 'g', 'avena']);
  const m = p('media taza de arroz'); assert.deepEqual([m.qty, m.unit, m.food], [0.5, 'taza', 'arroz']);
  const y = p('1 y media porción de pollo'); assert.deepEqual([y.qty, y.unit], [1.5, 'porción']);
  const d = p('1,5 kg de papa'); assert.deepEqual([d.qty, d.unit], [1.5, 'kg']);
  const s = p('un banano grande'); assert.deepEqual([s.size, s.food], ['grande', 'banano']);
  const n = p('arroz'); assert.deepEqual([n.qty, n.qtyExplicit], [1, false]);
  assert.equal(p('dos cucharadas de mantequilla de maní').unit, 'cucharada');
  assert.equal(p('1/2 aguacate').qty, 0.5);
});

test('escala porciones con conversiones honestas', () => {
  assert.equal(F.gymScaleFood(huevo, 2, 'unidad').kcal, 140);
  assert.equal(F.gymScaleFood(huevo, 100, 'g').kcal, 140); // 100 g / 50 g por unidad
  assert.equal(F.gymScaleFood(avena, 40, 'g').kcal, 152);
  assert.equal(F.gymScaleFood(jugo, 1, 'vaso').kcal, Math.round(110 * 240 / 250));
  assert.equal(F.gymScaleFood(avena, 1, 'taza'), null, 'taza (volumen) no se convierte a gramos sin densidad');
  assert.equal(F.gymScaleFood(arepa, 1, 'g'), null, 'sin gramos por unidad no se inventa');
  assert.equal(F.gymScaleFood(huevo, 0, 'unidad'), null);
});

test('encuentra el alimento aunque esté en plural o con otras palabras', () => {
  assert.equal(F.gymMatchFood('huevos', known)[0].food.id, 'h');
  assert.equal(F.gymMatchFood('jugo naranja', known)[0].food.id, 'j');
  assert.equal(F.gymMatchFood('arepa', known)[0].food.id, 'recent:arepa con queso');
  assert.equal(F.gymMatchFood('salmón ahumado', known).length, 0);
});

test('propuesta completa: ok, estimado, sin coincidencia y unidad imposible', () => {
  const items = F.gymParseMeal('2 huevos, una arepa con queso, un vaso de jugo de naranja, salmón, una taza de avena').map(i => F.gymProposeItem(i, known));
  assert.equal(items[0].status, 'ok'); assert.equal(items[0].nutrients.kcal, 140);
  assert.equal(items[1].status, 'ok'); // coincidencia exacta con un reciente y cantidad explícita
  assert.equal(items[2].nutrients.kcal, 106);
  assert.equal(items[3].status, 'nomatch');
  assert.equal(items[4].status, 'unit');
});

test('recientes: uno por nombre, con usos y la última porción', () => {
  const logs = [
    { name: 'Arepa con queso', quantity: 1, unit: 'unidad', kcal: 269, protein_g: 12, carbs_g: 35, fat_g: 9, fiber_g: 0, date: '2026-11-03', created_at: '2026-11-03T12:00:00Z' },
    { name: 'arepa con queso', quantity: 2, unit: 'unidades', kcal: 538, protein_g: 24, carbs_g: 70, fat_g: 18, fiber_g: 0, date: '2026-11-04', created_at: '2026-11-04T12:00:00Z' },
    { name: 'Café', quantity: null, unit: '', kcal: 5, protein_g: 0, carbs_g: 1, fat_g: 0, fiber_g: 0, date: '2026-11-04', created_at: '2026-11-04T08:00:00Z' },
  ];
  const r = F.gymRecentFoods(logs);
  assert.equal(r.length, 2);
  assert.equal(r[0].name, 'arepa con queso'); assert.equal(r[0].uses, 2);
  assert.deepEqual([r[0].serving_qty, r[0].serving_unit, r[0].kcal], [2, 'unidad', 538]);
  assert.equal(F.gymScaleFood(r[0], 1, 'unidad').kcal, 269);
  assert.equal(r[1].serving_unit, 'porción');
});
