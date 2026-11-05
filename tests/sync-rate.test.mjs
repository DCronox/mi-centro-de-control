import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Tarifa por hora al sincronizar: el valor por defecto de un dispositivo nuevo no debe pisar la de la cuenta.
const model = fs.readFileSync(new URL('../js/sync-model.js', import.meta.url), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(model + ';this.mergeData=mergeData;this.defaultData=defaultData', ctx);
const D = (o) => Object.assign(ctx.defaultData(), o);

test('primer inicio en un dispositivo nuevo: gana la tarifa de la cuenta, no el valor por defecto', () => {
  const cloud = D({ rate: 15500 }), local = D({}); // local = 13000 por defecto, sin marca
  assert.equal(ctx.mergeData(cloud, local).rate, 15500);
});

test('si la persona cambió la tarifa en este dispositivo (con marca), gana su cambio', () => {
  const cloud = D({ rate: 15500 }), local = D({ rate: 17000, rateU: 2000 });
  const m = ctx.mergeData(cloud, local);
  assert.deepEqual([m.rate, m.rateU], [17000, 2000]);
});

test('con marca en ambas copias gana la más reciente', () => {
  assert.equal(ctx.mergeData(D({ rate: 18000, rateU: 3000 }), D({ rate: 17000, rateU: 2000 })).rate, 18000);
  assert.equal(ctx.mergeData(D({ rate: 18000, rateU: 1000 }), D({ rate: 17000, rateU: 2000 })).rate, 17000);
});

test('una nube vieja sin tarifa no impone el valor por defecto sobre la local', () => {
  const cloud = { tx: [], goals: [], routines: [], inst: {}, shifts: [] }; // sin campo rate
  assert.equal(ctx.mergeData(cloud, D({ rate: 16000 })).rate, 16000);
});

test('sin cambios de tarifa no aparece la marca', () => {
  assert.equal('rateU' in ctx.mergeData(D({ rate: 15500 }), D({})), false);
});

test('sin marcas, una tarifa propia de este dispositivo (no la por defecto) sigue prevaleciendo', () => {
  assert.equal(ctx.mergeData(D({ rate: 10000 }), D({ rate: 15000 })).rate, 15000);
});
