import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const G = require('../js/gym/gym-calc.js');

const ex = [{ id: 'bp', name: 'Press banca', muscle: 'Pecho' }, { id: 'sq', name: 'Sentadilla', muscle: 'Cuádriceps' }];
const ses = [
  { id: 's1', started_at: '2026-10-27T11:00:00Z' }, // martes 27 oct
  { id: 's2', started_at: '2026-11-03T11:00:00Z' }, // martes 3 nov
];
const sets = [
  { id: 'a', session_id: 's1', exercise_id: 'bp', set_index: 1, weight_kg: 60, reps: 10 },
  { id: 'b', session_id: 's1', exercise_id: 'bp', set_index: 2, weight_kg: 60, reps: 8 },
  { id: 'c', session_id: 's2', exercise_id: 'bp', set_index: 1, weight_kg: 65, reps: 8 },
  { id: 'd', session_id: 's2', exercise_id: 'sq', set_index: 1, weight_kg: 100, reps: 5 },
  { id: 'x', session_id: 'borrada', exercise_id: 'bp', set_index: 1, weight_kg: 500, reps: 1 },
];

test('1RM estimado (Epley) y límites', () => {
  assert.equal(G.gymE1rm(100, 1), 100);
  assert.equal(G.gymE1rm(100, 5), 116.7);
  assert.equal(G.gymE1rm(100, 15), null, 'más de 12 reps no se estima');
  assert.equal(G.gymE1rm(0, 5), null);
});
test('fechas en hora de Bogotá y semana desde el lunes', () => {
  assert.equal(G.gymDateOf('2026-11-04T03:00:00Z'), '2026-11-03');
  assert.equal(G.gymWeekStart('2026-11-04'), '2026-11-02');
  assert.equal(G.gymWeekStart('2026-11-02'), '2026-11-02');
  assert.equal(G.gymWeekStart('2026-11-08'), '2026-11-02');
});
test('volumen semanal, récords y grupos musculares solo con datos registrados', () => {
  const s = G.gymStats(ses, sets, ex, '2026-11-04', { weeks: 3 });
  assert.deepEqual([...s.weekly.map(w => w.volume)], [0, 1080, 1020]);
  assert.equal(s.week.sessions, 1);
  const bp = s.prs.find(p => p.exercise_id === 'bp');
  assert.equal(bp.bestWeight, 65); assert.equal(bp.bestWeightReps, 8); assert.equal(bp.bestWeightDate, '2026-11-03');
  assert.equal(bp.bestE1rm, 82.3, '65×8 supera a 60×10 (80)');
  assert.equal(bp.sets, 3, 'la serie de una sesión inexistente no cuenta');
  assert.deepEqual([...s.muscles.map(m => m[0])], ['Pecho', 'Cuádriceps']);
  assert.equal(s.lastSession.id, 's2');
});
test('sin datos no se inventa nada', () => {
  const s = G.gymStats([], [], [], '2026-11-04');
  assert.equal(s.hasData, false); assert.equal(s.prs.length, 0); assert.equal(s.lastSession, null);
  assert.ok(s.weekly.every(w => w.volume === 0 && w.sessions === 0));
});
test('última vez en un ejercicio, excluyendo el entrenamiento en curso', () => {
  const p = G.gymLastPerformance('bp', ses, sets);
  assert.equal(p.date, '2026-11-03'); assert.deepEqual([...p.sets.map(x => x.weight_kg)], [65]);
  const q = G.gymLastPerformance('bp', ses, sets, 's2');
  assert.equal(q.date, '2026-10-27'); assert.equal(q.sets.length, 2);
  assert.equal(G.gymLastPerformance('nada', ses, sets), null);
});
test('tendencia de peso corporal necesita al menos dos mediciones', () => {
  assert.equal(G.gymWeightTrend([{ date: '2026-11-01', weight_kg: 80 }], '2026-11-04').change, null);
  const t = G.gymWeightTrend([{ date: '2026-10-10', weight_kg: 81.2 }, { date: '2026-11-03', weight_kg: 80 }, { date: '2026-11-01', weight_kg: null }], '2026-11-04');
  assert.equal(t.change, -1.2); assert.equal(t.latest.date, '2026-11-03');
});
