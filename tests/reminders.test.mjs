import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeReminders, atBogota, bogota, normalizePrefs } from '../js/reminders-core.mjs';

const base = () => ({ tx: [], goals: [], routines: [], inst: {}, budgets: [], obligations: [], scheduledShifts: [], rate: 13000, shifts: [] });
const keys = list => list.map(r => r.key);

test('la copia del servidor es idéntica a la del navegador', () => {
  const a = fs.readFileSync(new URL('../js/reminders-core.mjs', import.meta.url), 'utf8');
  const b = fs.readFileSync(new URL('../supabase/functions/_shared/reminders-core.mjs', import.meta.url), 'utf8');
  assert.equal(b, a, 'Copia js/reminders-core.mjs en supabase/functions/_shared/');
});
test('la hora de Bogotá es UTC−5', () => {
  assert.equal(atBogota('2026-11-03', '07:00'), Date.UTC(2026, 10, 3, 12, 0));
  assert.deepEqual({ ...bogota(Date.UTC(2026, 10, 4, 3, 30)) }, { date: '2026-11-03', time: '22:30', dow: 2 });
});
test('avisa un pago el día anterior, el mismo día y cuando vence, cada uno a su hora', () => {
  const d = base(); d.tx.push({ id: 'p', type: 'gasto', name: 'Internet', amount: 95000, date: '2026-11-05', status: 'pendiente' });
  assert.deepEqual(keys(computeReminders(d, {}, atBogota('2026-11-04', '07:05'))), ['pay-lead:p:2026-11-05']);
  assert.deepEqual(keys(computeReminders(d, {}, atBogota('2026-11-05', '07:01')).filter(r => r.category === 'finanzas')), ['pay-today:p:2026-11-05']);
  assert.deepEqual(keys(computeReminders(d, {}, atBogota('2026-11-06', '09:10'))), ['pay-over:p:2026-11-05']);
  assert.equal(computeReminders(d, {}, atBogota('2026-11-04', '06:59')).length, 0, 'antes de la hora no sale nada');
  assert.equal(computeReminders(d, {}, atBogota('2026-11-04', '11:00')).length, 0, 'con más de 3 h de retraso ya no se envía');
});
test('un pago ya pagado no genera avisos', () => {
  const d = base(); d.tx.push({ id: 'p', type: 'gasto', name: 'Internet', amount: 95000, date: '2026-11-05', status: 'pagado' });
  assert.equal(computeReminders(d, {}, atBogota('2026-11-05', '07:01')).length, 0);
});
test('recordatorio del turno 60 min antes, aunque sea en horario de no molestar', () => {
  const d = base(); d.scheduledShifts.push({ id: 's', date: '2026-11-03', in: '23:00', out: '05:00', brk: 0, rate: 13000 });
  const r = computeReminders(d, {}, atBogota('2026-11-03', '22:00'));
  assert.deepEqual(keys(r), ['shift-start:s:2026-11-03:23:00']);
  assert.match(r[0].body, /6\.0 h/);
});
test('si el turno terminó y no se registró, pide registrarlo (cruce de medianoche)', () => {
  const d = base(); d.scheduledShifts.push({ id: 's', date: '2026-11-03', in: '17:00', out: '00:00', brk: 0 });
  assert.ok(keys(computeReminders(d, {}, atBogota('2026-11-04', '00:31'))).includes('shift-rec:s'));
});
test('turno abierto: recuerda marcar la salida', () => {
  const d = base(), start = atBogota('2026-11-03', '08:00'); d.activeShift = { on: true, in: '08:00', startedAt: start, u: start };
  assert.deepEqual(keys(computeReminders(d, {}, start + 9 * 3600000 + 60000)), ['clockout:' + start]);
});
test('tareas con recordatorio, incluidas rutinas que aún no se generaron hoy', () => {
  const d = base();
  d.inst['2026-11-03'] = [{ id: 't', name: 'Estudiar', time: '19:00', remind: '30' }, { id: 'n', name: 'Sin aviso', time: '19:00' }];
  d.routines.push({ id: 'r', name: 'Gimnasio', time: '18:00', remind: '10', days: [2], from: '2026-01-01', active: true });
  assert.deepEqual(keys(computeReminders(d, {}, atBogota('2026-11-03', '17:51'))), ['task-r:r:2026-11-03']);
  assert.deepEqual(keys(computeReminders(d, {}, atBogota('2026-11-03', '18:31'))), ['task-r:r:2026-11-03', 'task:t:2026-11-03']);
});
test('las tareas hechas no se recuerdan', () => {
  const d = base(); d.inst['2026-11-03'] = [{ id: 't', name: 'Estudiar', time: '19:00', remind: '0', done: true }];
  assert.equal(computeReminders(d, {}, atBogota('2026-11-03', '19:00')).length, 0);
});
test('presupuesto al 80 % y al 100 % respeta el horario de no molestar', () => {
  const d = base(); d.budgets.push({ id: 'b', cat: 'Alimentación', amount: 100000 });
  d.tx.push({ id: 'g', type: 'gasto', name: 'Mercado', amount: 85000, date: '2026-11-02', status: 'pagado', cat: 'Alimentación' });
  assert.deepEqual(keys(computeReminders(d, {}, atBogota('2026-11-03', '12:00'))), ['budget80:alimentación:2026-11']);
  assert.equal(computeReminders(d, {}, atBogota('2026-11-03', '23:00')).length, 0);
});
test('las categorías desactivadas y el interruptor general se respetan', () => {
  const d = base(); d.tx.push({ id: 'p', type: 'gasto', name: 'X', amount: 1, date: '2026-11-03', status: 'pendiente' });
  const now = atBogota('2026-11-03', '07:01');
  assert.equal(computeReminders(d, { categories: { finanzas: false } }, now).filter(r => r.category === 'finanzas').length, 0);
  assert.equal(computeReminders(d, { enabled: false }, now).length, 0);
});
test('fecha objetivo de una meta y recordatorio de ahorro mensual', () => {
  const d = base(); d.goals.push({ id: 'g', name: 'Moto', target: 1000, monthly: 300, targetDate: '2026-11-10', aportes: [{ id: 'a', amount: 100, date: '2026-10-01' }] });
  assert.deepEqual(keys(computeReminders(d, {}, atBogota('2026-11-03', '07:00'))), ['goal-lead:g:2026-11-10']);
  assert.deepEqual(keys(computeReminders(d, { goalLeadDays: 0 }, atBogota('2026-11-25', '07:00'))), ['save:2026-11']);
});
test('resumen del día y de la semana solo si hay algo que contar', () => {
  const d = base();
  assert.equal(computeReminders(d, {}, atBogota('2026-11-03', '07:00')).length, 0);
  d.inst['2026-11-03'] = [{ id: 't', name: 'Leer' }];
  d.shifts.push({ id: 'x', date: '2026-11-01', in: '08:00', out: '12:00', brk: 0, rate: 10000, paid: false });
  assert.deepEqual(keys(computeReminders(d, {}, atBogota('2026-11-03', '07:00'))), ['daily:2026-11-03']);
  assert.deepEqual(keys(computeReminders(d, { weeklyDay: 2 }, atBogota('2026-11-03', '19:00'))), ['week:2026-11-03']);
});
test('preferencias inválidas vuelven a los valores por defecto', () => {
  const p = normalizePrefs({ summaryTime: '7am', paymentLeadDays: -3, categories: { metas: false } });
  assert.equal(p.summaryTime, '07:00'); assert.equal(p.paymentLeadDays, 1); assert.equal(p.categories.metas, false); assert.equal(p.categories.finanzas, true);
});
test('datos vacíos o dañados no rompen el cálculo', () => {
  assert.deepEqual(computeReminders(null, {}, Date.now()), []);
  assert.deepEqual(computeReminders({ tx: 'x', inst: [], goals: [null] }, {}, Date.now()), []);
});
