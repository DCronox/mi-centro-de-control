import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const I = require('../js/gym/gym-insights.js');

const today = '2026-11-04';
const keys = (ctx) => I.gymInsights(ctx).map((x) => x.key);
const target = { kcal: 2400, protein_g: 150, water_ml: 2500 };
const week = (o) => ({ withTarget: 5, proteinHit: 1, avg: { kcal: 2400, protein_g: 100 }, ...o });

test('sin datos no hay recomendaciones', () => {
  assert.deepEqual(keys({ today }), []);
  assert.deepEqual(keys({ today, target, goal: 'maintenance' }), []);
});

test('proteína baja solo con ≥3 días de registro', () => {
  assert.ok(keys({ today, target, week: week() }).includes('protein-low'));
  assert.ok(!keys({ today, target, week: week({ withTarget: 2 }) }).includes('protein-low'));
  assert.ok(!keys({ today, target, week: week({ proteinHit: 4, avg: { kcal: 2400, protein_g: 145 } }) }).includes('protein-low'));
});

test('cada recomendación trae observación, datos, conclusión, acción y confianza', () => {
  for (const x of I.gymInsights({ today, target, goal: 'fat_loss', week: week({ avg: { kcal: 2900, protein_g: 100 } }), lastWeightDate: null, sleep: { cur: 6, n: 4 } })) {
    assert.ok(x.title && x.observation && x.conclusion && x.action?.tab && x.confidence, x.key);
    assert.ok(Array.isArray(x.data) && x.data.length > 0, 'sin datos: ' + x.key);
    assert.ok(['observation', 'estimation', 'recommendation'].includes(x.type));
  }
});

test('ritmo de peso: necesita 4 medidas en 14 días y estima la pendiente', () => {
  const M = (d, w) => ({ date: d, weight_kg: w });
  assert.equal(I.gymWeightRate([M('2026-11-01', 80), M('2026-11-03', 80), M('2026-11-04', 80)], today).enough, false);
  const r = I.gymWeightRate([M('2026-10-14', 80), M('2026-10-21', 79.6), M('2026-10-28', 79.2), M('2026-11-04', 78.8)], today);
  assert.equal(r.enough, true); assert.equal(r.kgWeek, -0.4); assert.equal(r.pctWeek, -0.5);
});

test('peso estancado con objetivo de perder grasa → estimación; ritmo adecuado → nada', () => {
  const flat = { enough: true, n: 6, span: 21, kgWeek: 0.05, pctWeek: 0.06, seWeek: 0.1, confidence: 'media' };
  const ok = { ...flat, kgWeek: -0.4, pctWeek: -0.5 };
  assert.ok(keys({ today, target, goal: 'fat_loss', weightRate: flat, lastWeightDate: today }).includes('weight-flat-loss'));
  assert.ok(!keys({ today, target, goal: 'fat_loss', weightRate: ok, lastWeightDate: today }).some((k) => k.startsWith('weight')));
  assert.ok(keys({ today, target, goal: 'fat_loss', weightRate: { ...flat, pctWeek: -1.3 }, lastWeightDate: today }).includes('weight-fast-loss'));
  assert.ok(keys({ today, target, goal: 'muscle_gain', weightRate: { ...flat, pctWeek: -0.2 }, lastWeightDate: today }).includes('weight-down-gain'));
});

test('pedir peso si no hay medición en 14 días', () => {
  assert.ok(keys({ today, target, goal: 'fat_loss', lastWeightDate: '2026-10-10' }).includes('weight-missing'));
  assert.ok(!keys({ today, target, goal: 'fat_loss', lastWeightDate: '2026-11-01' }).includes('weight-missing'));
});

test('constancia y músculos sin estímulo', () => {
  assert.ok(keys({ today, plannedPerWeek: 4, sessions14: 3 }).includes('consistency-low'));
  assert.ok(!keys({ today, plannedPerWeek: 4, sessions14: 6 }).includes('consistency-low'));
  const muscles = [{ name: 'Pectoral', group: 'Pecho', weightedSets: 12 }, { name: 'Cuádriceps', group: 'Piernas', weightedSets: 0 }];
  assert.ok(keys({ today, sessions14: 5, muscles14: muscles }).includes('muscles-zero'));
  assert.ok(!keys({ today, sessions14: 3, muscles14: muscles }).includes('muscles-zero'), 'con pocas sesiones no se concluye');
});

test('progresión, sueño, estado de hoy y agua', () => {
  const k = keys({ today, target, progressions: [{ name: 'Press', action: 'increase', title: 'Sube' }, { name: 'Remo', action: 'reduce', title: 'Baja' }],
    sleep: { cur: 6.2, n: 4 }, readiness: { level: 'low', reasons: ['Dormiste 4 h.'] }, waterDays: [{ ml: 1000 }, { ml: 1200 }, { ml: 900 }] });
  for (const x of ['prog-up', 'prog-down', 'sleep-low', 'readiness-low', 'water-low']) assert.ok(k.includes(x), x);
  assert.ok(!keys({ today, sleep: { cur: 6, n: 2 } }).includes('sleep-low'), 'sueño con menos de 3 registros no cuenta');
  assert.equal(I.gymInsights({ today, progressions: [{ name: 'Remo', action: 'reduce', title: 'Baja' }], sleep: { cur: 8, n: 4 } })[0].key, 'prog-down');
});
