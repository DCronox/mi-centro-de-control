import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const N = require('../js/gym/gym-nutrition.js');

const T = (o) => ({ status: 'accepted', kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 60, fiber_g: 28, water_ml: 2500, ...o });
const foods = [
  { date: '2026-11-04', meal: 'breakfast', kcal: 500, protein_g: 30, carbs_g: 60, fat_g: 15, fiber_g: 5 },
  { date: '2026-11-04', meal: 'lunch', kcal: 800, protein_g: 50.25, carbs_g: 90, fat_g: 25, fiber_g: 9, estimated: true },
  { date: '2026-11-03', meal: 'lunch', kcal: 2600, protein_g: 140, carbs_g: 300, fat_g: 90, fiber_g: 20 },
];
const water = [{ date: '2026-11-04', ml: 250 }, { date: '2026-11-04', ml: 500 }, { date: '2026-11-03', ml: 2000 }];

test('totales del día suman solo esa fecha', () => {
  const t = N.gymDayTotals(foods, water, '2026-11-04');
  assert.equal(t.kcal, 1300); assert.equal(t.protein_g, 80.3); assert.equal(t.water_ml, 750);
  assert.equal(t.entries, 2); assert.equal(t.estimated, 1);
  const e = N.gymDayTotals(foods, water, '2026-11-01');
  assert.equal(e.kcal, 0); assert.equal(e.entries, 0);
});

test('progreso: el anillo no pasa de 1 y el exceso se informa', () => {
  const p = N.gymProgress(2600, 2000);
  assert.equal(p.ring, 1); assert.equal(p.pct, 130); assert.equal(p.over, 30); assert.equal(p.state, 'over');
  assert.equal(N.gymProgress(1000, 2000).ring, 0.5);
  assert.equal(N.gymProgress(1900, 2000).state, 'ok');
  assert.equal(N.gymProgress(0, 2000).state, 'empty');
  assert.equal(N.gymProgress(500, null).state, 'none');
  assert.equal(N.gymProgress(1500, 2000).remaining, 500);
});

test('objetivo vigente según la fecha (incluye reemplazados en su periodo)', () => {
  const ts = [T({ id: 'a', status: 'superseded', kcal: 2400, created_at: '2026-10-01T10:00:00Z', effective_from: '2026-10-01' }),
              T({ id: 'b', created_at: '2026-11-02T10:00:00Z', effective_from: '2026-11-02' }),
              T({ id: 'p', status: 'proposed', created_at: '2026-11-03T10:00:00Z', effective_from: '2026-11-03' })];
  assert.equal(N.gymTargetFor(ts, '2026-10-15').id, 'a');
  assert.equal(N.gymTargetFor(ts, '2026-11-04').id, 'b');
  assert.equal(N.gymTargetFor(ts, '2026-09-01'), null);
});

test('semana: promedia solo días con registro y compara con la anterior', () => {
  const ts = [T({ created_at: '2026-10-01T10:00:00Z', effective_from: '2026-10-01' })];
  const prevFoods = [{ date: '2026-10-28', kcal: 2000, protein_g: 100, carbs_g: 0, fat_g: 0, fiber_g: 0 }];
  const w = N.gymWeekNutrition([...foods, ...prevFoods], water, ts, '2026-11-04');
  assert.equal(w.days.length, 7);
  assert.equal(w.days[6].date, '2026-11-04');
  assert.equal(w.loggedDays, 2);
  assert.equal(w.avg.kcal, 1950); // (1300 + 2600) / 2, sin contar días vacíos
  assert.equal(w.prevAvg.kcal, 2000);
  assert.equal(w.kcalChangePct, -2); // -2,5 % redondeado
  assert.equal(w.proteinHit, 1); // 140/150 = 93 %
  assert.equal(w.kcalInRange, 0);
});

test('semana sin registros no inventa datos', () => {
  const w = N.gymWeekNutrition([], [], [], '2026-11-04');
  assert.equal(w.avg, null); assert.equal(w.kcalChangePct, null); assert.equal(w.loggedDays, 0);
});

test('validación de comida manual y kcal derivadas', () => {
  assert.ok(N.gymValidateFood({ name: '', meal: 'x', date: 'hoy' }).length >= 3);
  assert.deepEqual(N.gymValidateFood({ name: 'Arepa', meal: 'breakfast', date: '2026-11-04', kcal: 220 }), []);
  assert.ok(N.gymValidateFood({ name: 'Arepa', meal: 'breakfast', date: '2026-11-04', kcal: -5 }).length);
  assert.deepEqual(N.gymFoodKcal({ protein_g: 10, carbs_g: 20, fat_g: 5 }), { kcal: 165, derived: true });
  assert.deepEqual(N.gymFoodKcal({ kcal: 300, protein_g: 10 }), { kcal: 300, derived: false });
});

test('cambio de día cruza meses', () => {
  assert.equal(N.gymAddDays('2026-11-01', -1), '2026-10-31');
  assert.equal(N.gymAddDays('2026-12-31', 1), '2027-01-01');
});
