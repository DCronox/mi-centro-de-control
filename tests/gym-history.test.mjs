import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const H = require('../js/gym/gym-history.js');

const add = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

test('valores t de Student al 95 %', () => {
  assert.equal(H.ghT95(6), 2.447); assert.equal(H.ghT95(11), 2.179); assert.equal(H.ghT95(500), 1.96); assert.equal(H.ghT95(0), Infinity);
});

test('línea perfecta: pendiente exacta e intervalo de ancho cero', () => {
  const s = Array.from({ length: 8 }, (_, i) => ({ date: add('2026-10-01', i * 4), value: 80 - 0.1 * i * 4 }));
  const p = H.gymProjection(s, { horizon: 28 });
  assert.equal(p.enough, true);
  assert.equal(p.perWeek, -0.7);
  assert.equal(p.target.value, Math.round((80 - 0.1 * (28 + 28)) * 10) / 10);
  assert.equal(p.target.lo, p.target.hi);
});

test('con ruido: intervalo de predicción calculado a mano', () => {
  // x = 0,4,...,28 ; y con ruido conocido
  const ys = [80, 79.8, 79.9, 79.5, 79.6, 79.2, 79.3, 78.9];
  const s = ys.map((y, i) => ({ date: add('2026-10-01', i * 4), value: y }));
  const p = H.gymProjection(s, { horizon: 14 });
  const xs = ys.map((_, i) => i * 4), n = 8, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0), b = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx, a0 = my - b * mx;
  const sse = xs.reduce((a, x, i) => a + (ys[i] - (a0 + b * x)) ** 2, 0), sd = Math.sqrt(sse / (n - 2)), x0 = 28 + 14;
  const h = 2.447 * sd * Math.sqrt(1 + 1 / n + (x0 - mx) ** 2 / sxx), yhat = a0 + b * x0;
  assert.equal(p.target.value, Math.round(yhat * 10) / 10);
  assert.equal(p.target.lo, Math.round((yhat - h) * 10) / 10);
  assert.equal(p.target.hi, Math.round((yhat + h) * 10) / 10);
  assert.ok(p.band[2].hi - p.band[2].lo > p.band[0].hi - p.band[0].lo, 'el intervalo se abre con el horizonte');
});

test('sin base estadística: menos de 8 registros o menos de 4 semanas', () => {
  const few = Array.from({ length: 7 }, (_, i) => ({ date: add('2026-10-01', i * 7), value: 80 }));
  assert.equal(H.gymProjection(few).enough, false);
  assert.match(H.gymProjection(few).reason, /Sin base estadística/);
  const short = Array.from({ length: 10 }, (_, i) => ({ date: add('2026-10-01', i * 2), value: 80 }));
  assert.equal(H.gymProjection(short).enough, false);
  assert.equal(H.gymProjection([]).enough, false);
});

test('serie de 1RM: mejor estimación por día y solo hasta 12 repeticiones', () => {
  const sessions = [{ id: 'a', started_at: '2026-10-01T17:00:00Z' }, { id: 'b', started_at: '2026-10-05T17:00:00Z' }];
  const sets = [{ session_id: 'a', exercise_id: 'x', weight_kg: 60, reps: 10 }, { session_id: 'a', exercise_id: 'x', weight_kg: 65, reps: 6 },
    { session_id: 'b', exercise_id: 'x', weight_kg: 40, reps: 20 }, { session_id: 'b', exercise_id: 'y', weight_kg: 100, reps: 5 }];
  assert.deepEqual(H.gymE1rmSeries('x', sessions, sets, '2026-09-01', '2026-11-01'), [{ date: '2026-10-01', value: 80 }]);
});

test('resumen semanal: promedios solo con días registrados', () => {
  const r = H.gymHistorySummary({ from: '2026-10-26', to: '2026-11-08',
    sessions: [{ id: 's', started_at: '2026-10-28T17:00:00Z' }], sets: [{ session_id: 's', weight_kg: 50, reps: 10 }, { session_id: 's', weight_kg: 50, reps: 8 }],
    foods: [{ date: '2026-10-27', kcal: 2000, protein_g: 120 }, { date: '2026-10-27', kcal: 500, protein_g: 30 }, { date: '2026-10-29', kcal: 1900, protein_g: 100 }],
    recovery: [{ date: '2026-11-03', sleep_h: 7 }, { date: '2026-11-04', sleep_h: 6 }], metrics: [{ date: '2026-11-02', weight_kg: 80 }] });
  assert.equal(r.length, 2);
  assert.deepEqual([r[0].period, r[0].sessions, r[0].sets, r[0].volume, r[0].loggedDays, r[0].kcalAvg, r[0].proteinAvg], ['2026-10-26', 1, 2, 900, 2, 2200, 125]);
  assert.deepEqual([r[1].sleepAvg, r[1].sleepN, r[1].kcalAvg, r[1].weightAvg, r[0].weightAvg], [6.5, 2, null, 80, null]); // 2026-11-02 es lunes
  const d = H.gymHistorySummary({ from: '2026-11-01', to: '2026-11-07', daily: true });
  assert.equal(d.length, 7);
});
