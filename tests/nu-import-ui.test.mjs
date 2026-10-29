import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../nu-import-ui.mjs', import.meta.url), 'utf8');
const canConfirm = source.split(/\r?\n/).find(line => line.startsWith('function canConfirm('));
assert.ok(canConfirm, 'canConfirm existe');

function valid(rows) {
  const context = { TYPES: [['gasto'], ['ingreso'], ['devolucion'], ['transferencia'], ['pago_tarjeta'], ['anulada'], ['por_revisar']] };
  vm.runInNewContext(`${canConfirm}\nglobalThis.result=canConfirm(globalThis.rows);`, Object.assign(context, { rows }));
  return context.result;
}

test('la fecha ISO válida habilita confirmar e importar', () => {
  assert.equal(valid([{ selected: true, date: '2026-10-28', description: 'Compra', amount: 12500, type: 'gasto' }]), true);
});

test('no se puede confirmar una fecha inválida, un movimiento sin selección o por revisar', () => {
  assert.equal(valid([{ selected: true, date: '28/10/2026', description: 'Compra', amount: 12500, type: 'gasto' }]), false);
  assert.equal(valid([{ selected: false, date: '2026-10-28', description: 'Compra', amount: 12500, type: 'gasto' }]), false);
  assert.equal(valid([{ selected: true, date: '2026-10-28', description: 'Movimiento', amount: 12500, type: 'por_revisar' }]), false);
});
