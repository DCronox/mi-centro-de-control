import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const lineFunction = name => source.split(/\r?\n/).find(line => line.startsWith(`function ${name}(`));
const lineConst = name => source.split(/\r?\n/).find(line => line.startsWith(`const ${name}=`));
const insightModel = source.slice(source.indexOf('function insightsMonthData('), source.indexOf('function insightTrendSvg('));
const financeFunctions = ['reportTotals', 'expenseCategories', 'monthShift'].map(lineFunction).join('\n');
const addDays = lineConst('addDays');

function getModel(tx, extras = {}) {
  const S = {
    tx,
    budgets: [{ cat: 'Alimentación', amount: 50000 }],
    goals: [{ id: 'g1', name: 'Viaje', target: 100000, monthly: 15000, aportes: [{ amount: 25000, date: '2026-10-01' }] }],
    ...extras,
  };
  const context = { S, hoy: () => '2026-10-28', mes: d => d.slice(0, 7), ...Math, Date };
  vm.runInNewContext(`${addDays}\n${financeFunctions}\n${insightModel}\nglobalThis.result=insightsMonthData('2026-10',6);`, context);
  return context.result;
}

test('Insights netea devoluciones, conserva categorías y proyecta solo pendientes confirmados', () => {
  const data = getModel([
    { type: 'ingreso', amount: 100000, status: 'recibido', date: '2026-10-02', cat: 'Trabajo' },
    { type: 'gasto', amount: 40000, status: 'pagado', date: '2026-10-03', cat: 'Alimentación' },
    { type: 'devolucion', amount: 10000, status: 'recibido', date: '2026-10-05', cat: 'Alimentación' },
    { type: 'transferencia', amount: 25000, status: 'recibido', date: '2026-10-06', cat: 'Otros' },
    { type: 'pago_tarjeta', amount: 15000, status: 'pagado', date: '2026-10-07', cat: 'Otros' },
    { type: 'gasto', amount: 20000, status: 'pendiente', date: '2026-10-29', cat: 'Hogar', obligationId: 'o1' },
    { type: 'ingreso', amount: 5000, status: 'pendiente', date: '2026-10-30', cat: 'Trabajo' },
    { type: 'devolucion', amount: 2000, status: 'pendiente', date: '2026-10-30', cat: 'Alimentación' },
  ]);
  assert.equal(data.totals.inc, 100000);
  assert.equal(data.totals.gas, 30000);
  assert.equal(data.paidNet, 70000);
  assert.equal(data.categories['Alimentación'], 30000);
  assert.equal(data.pendingExpenses, 20000);
  assert.equal(data.committed, 57000);
  assert.equal(data.budgetPct, 60);
  assert.equal(data.goalRows[0].saved, 25000);
  assert.equal(data.goalRows[0].remaining, 75000);
  assert.equal(data.obligations.length, 1);
  assert.equal(data.obligations.reduce((sum, t) => sum + t.amount, 0), 20000);
});

test('Insights representa el periodo vacío sin inventar movimientos', () => {
  const data = getModel([]);
  assert.equal(data.hasPeriodData, false);
  assert.equal(data.totals.inc, 0);
  assert.equal(data.totals.gas, 0);
  assert.equal(data.budgetPct, 0);
  assert.equal(data.history.some(month => month.hasData), false);
});
