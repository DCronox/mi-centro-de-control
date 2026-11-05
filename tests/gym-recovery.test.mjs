import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../js/gym/gym-recovery.js');

test('horas de sueño cruzando la medianoche', () => {
  assert.equal(R.gymSleepHours('23:30', '06:45'), 7.3);
  assert.equal(R.gymSleepHours('01:00', '08:00'), 7);
  assert.equal(R.gymSleepHours('22:00', ''), null);
  assert.equal(R.gymLogSleep({ sleep_h: 6.5, bed_time: '23:00', wake_time: '07:00' }), 6.5, 'lo escrito manda');
});

test('estado de hoy: sin datos, bien, precaución y bajo', () => {
  assert.equal(R.gymReadiness(null).level, 'unknown');
  assert.equal(R.gymReadiness({ date: 'x' }).level, 'unknown');
  assert.equal(R.gymReadiness({ sleep_h: 8, energy: 4, fatigue: 2 }).level, 'ok');
  const c = R.gymReadiness({ sleep_h: 6, energy: 3 });
  assert.equal(c.level, 'caution'); assert.ok(c.reasons[0].includes('6 h'));
  assert.equal(R.gymReadiness({ sleep_h: 4.5 }).level, 'low');
  assert.equal(R.gymReadiness({ sleep_h: 7.5, fatigue: 5, soreness: 4, stress: 4 }).level, 'low');
});

test('tendencia solo con al menos 3 registros por semana', () => {
  const L = (date, sleep_h, energy) => ({ date, sleep_h, energy });
  const logs = [L('2026-11-04', 7, 4), L('2026-11-02', 8, 4), L('2026-10-30', 7.5, 3), L('2026-10-27', 6, 2), L('2026-10-25', 6.5, 3), L('2026-10-23', 6, 2)];
  const t = R.gymRecoveryTrend(logs, '2026-11-04');
  assert.deepEqual([t.sleep_h.cur, t.sleep_h.prev, t.sleep_h.enough, t.sleep_h.delta], [7.5, 6.2, true, 1.3]);
  const few = R.gymRecoveryTrend(logs.slice(0, 4), '2026-11-04');
  assert.equal(few.sleep_h.enough, false); assert.equal(few.sleep_h.delta, null);
});

test('por músculo: días desde el estímulo y molestias, sin decir «recuperado»', () => {
  const st30 = { cuadriceps: { name: 'Cuádriceps', group: 'Pierna', dates: ['2026-10-28', '2026-11-03'] }, pectoral_mayor: { name: 'Pectoral mayor', group: 'Pecho', dates: ['2026-10-29'] }, biceps: { name: 'Bíceps', group: 'Brazos', dates: [] } };
  const st7 = { cuadriceps: { weightedSets: 8 }, pectoral_mayor: { weightedSets: 0 } };
  const rows = R.gymMuscleRecovery(st7, st30, ['cuadriceps'], '2026-11-04');
  assert.deepEqual(rows.map((r) => r.id), ['cuadriceps', 'pectoral_mayor']);
  assert.deepEqual([rows[0].daysSince, rows[0].flag, rows[0].weightedSets7], [1, 'caution', 8]);
  assert.equal(rows[1].daysSince, 6);
  assert.ok(rows.every((r) => !/recuperad/i.test(r.note)));
});
