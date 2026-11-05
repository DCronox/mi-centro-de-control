import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../js/gym/gym-progression.js');

const T = { sets: 3, reps_min: 8, reps_max: 12, rir_target: 2, increment_kg: 2.5 };
const S = (date, sets) => ({ session_id: date, started_at: date + 'T12:00:00Z', sets: sets.map(([w, r, rpe = null], i) => ({ weight: w, reps: r, rpe, set_index: i + 1 })) });
const today = '2026-11-04';

test('sin historial: indica cómo elegir el peso inicial', () => {
  const p = P.gymProgression(T, [], { today });
  assert.equal(p.action, 'start'); assert.equal(p.weight, null);
});

test('completar el rango con el RIR objetivo → subir el incremento', () => {
  const p = P.gymProgression(T, [S('2026-11-02', [[60, 12, 8], [60, 12, 8], [60, 12, 8]])], { today });
  assert.deepEqual([p.action, p.weight, p.confidence], ['increase', 62.5, 'alta']);
});

test('completar el rango sin RPE registrado → subir con confianza media y pedir RPE', () => {
  const p = P.gymProgression(T, [S('2026-11-02', [[60, 12], [60, 12], [60, 12]])], { today });
  assert.deepEqual([p.action, p.confidence], ['increase', 'media']);
  assert.ok(p.notes.some((n) => /RPE/.test(n)));
});

test('completar el rango pero al fallo (RIR 0 con objetivo 2) → mantener', () => {
  const p = P.gymProgression(T, [S('2026-11-02', [[60, 12, 10], [60, 12, 9], [60, 12, 10]])], { today });
  assert.deepEqual([p.action, p.weight], ['maintain', 60]);
});

test('dentro del rango → mantener y reconocer la mejora', () => {
  const h = [S('2026-11-02', [[60, 11], [60, 10], [60, 9]]), S('2026-10-30', [[60, 10], [60, 9], [60, 8]])];
  const p = P.gymProgression(T, h, { today });
  assert.equal(p.action, 'maintain');
  assert.ok(p.reasons.some((r) => /\+3 repeticiones/.test(r)));
});

test('fallar el mínimo una vez → repetir; dos veces seguidas con el mismo peso → bajar ~10 %', () => {
  const once = P.gymProgression(T, [S('2026-11-02', [[60, 9], [60, 8], [60, 6]]), S('2026-10-30', [[60, 10], [60, 9], [60, 8]])], { today });
  assert.deepEqual([once.action, once.weight], ['retry', 60]);
  const twice = P.gymProgression(T, [S('2026-11-02', [[60, 9], [60, 8], [60, 6]]), S('2026-10-30', [[60, 8], [60, 7], [60, 7]])], { today });
  assert.deepEqual([twice.action, twice.weight], ['reduce', 52.5]); // floor(54/2,5)*2,5
});

test('no se sube si faltaron series de trabajo', () => {
  const p = P.gymProgression(T, [S('2026-11-02', [[60, 12], [60, 12]])], { today });
  assert.equal(p.action, 'maintain');
});

test('las series de aproximación (menos peso) no cuentan', () => {
  const p = P.gymProgression(T, [S('2026-11-02', [[40, 12], [60, 12, 8], [60, 12, 8], [60, 12, 8]])], { today });
  assert.deepEqual([p.action, p.weight], ['increase', 62.5]);
});

test('salto mayor del 10 % → aviso', () => {
  const p = P.gymProgression({ ...T, increment_kg: 2 }, [S('2026-11-02', [[10, 12, 8], [10, 12, 8], [10, 12, 8]])], { today });
  assert.equal(p.weight, 12); assert.ok(p.notes.some((n) => /20 %/.test(n)));
});

test('peso corporal o incremento 0 → progresar en repeticiones', () => {
  const p = P.gymProgression({ ...T, increment_kg: 0 }, [S('2026-11-02', [[0, 12], [0, 12], [0, 12]])], { today, name: 'Dominadas' });
  assert.equal(p.action, 'reps');
});

test('rendimiento claramente peor que las sesiones anteriores → no subir', () => {
  const h = [S('2026-11-02', [[50, 12, 8], [50, 12, 8], [50, 12, 8]]), S('2026-10-30', [[60, 10], [60, 10], [60, 10]])];
  const p = P.gymProgression(T, h, { today });
  assert.equal(p.action, 'maintain'); assert.ok(p.notes.some((n) => /por debajo/.test(n)));
});

test('más de 3 semanas sin hacerlo → prudencia', () => {
  const p = P.gymProgression(T, [S('2026-10-01', [[60, 12, 8], [60, 12, 8], [60, 12, 8]])], { today });
  assert.deepEqual([p.action, p.weight, p.confidence], ['maintain', 60, 'baja']);
});

test('incremento por defecto según el tipo de ejercicio', () => {
  assert.equal(P.gymDefaultIncrement('Press de banca'), 2.5);
  assert.equal(P.gymDefaultIncrement('Press inclinado con mancuernas'), 2);
  assert.equal(P.gymDefaultIncrement('Jalón al pecho en polea'), 5);
  assert.equal(P.gymDefaultIncrement('Dominadas'), 0);
});

test('historial: agrupa por sesión, más reciente primero, sin la sesión actual', () => {
  const sessions = [{ id: 'a', started_at: '2026-10-30T12:00:00Z' }, { id: 'b', started_at: '2026-11-02T12:00:00Z' }, { id: 'c', started_at: '2026-11-04T12:00:00Z' }];
  const sets = [{ session_id: 'a', exercise_id: 'x', set_index: 1, weight_kg: 50, reps: 10 }, { session_id: 'b', exercise_id: 'x', set_index: 2, weight_kg: 55, reps: 8 },
    { session_id: 'b', exercise_id: 'x', set_index: 1, weight_kg: 55, reps: 9, rpe: 8 }, { session_id: 'c', exercise_id: 'x', set_index: 1, weight_kg: 60, reps: 5 }, { session_id: 'b', exercise_id: 'y', set_index: 1, weight_kg: 1, reps: 1 }];
  const h = P.gymExerciseHistory('x', sessions, sets, { excludeSession: 'c' });
  assert.deepEqual(h.map((s) => s.session_id), ['b', 'a']);
  assert.deepEqual(h[0].sets.map((s) => [s.reps, s.rpe]), [[9, 8], [8, null]]);
});

test('con mala recuperación declarada hoy no se propone subir', () => {
  const h = [S('2026-11-02', [[60, 12, 8], [60, 12, 8], [60, 12, 8]])];
  const p = P.gymProgression(T, h, { today, readiness: { level: 'caution', reasons: ['Dormiste 5,5 h.'] } });
  assert.deepEqual([p.action, p.weight], ['maintain', 60]);
  assert.ok(p.notes.some((n) => /dormiste 5,5 h/.test(n)));
  assert.equal(P.gymProgression(T, h, { today, readiness: { level: 'ok', reasons: [] } }).action, 'increase');
});
