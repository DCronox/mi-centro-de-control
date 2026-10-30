import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMovement, matchPossibleDuplicates, parseAmountToken, parseDateToken, parseNuStatement, parseNuStatementText, pdfItemsToLines } from '../nu-pdf-import.mjs';

test('interpreta fechas colombianas y meses escritos', () => {
  assert.equal(parseDateToken('31/10/2026'), '2026-10-31');
  assert.equal(parseDateToken('2026-10-31'), '2026-10-31');
  assert.equal(parseDateToken('3 oct 2026'), '2026-10-03');
  assert.equal(parseDateToken('31/02/2026'), null);
});

test('lee importes colombianos, signos y decimales', () => {
  assert.deepEqual(parseAmountToken('-$ 1.234,56'), { amount: 1234.56, negative: true });
  assert.deepEqual(parseAmountToken('COP 1.234.567'), { amount: 1234567, negative: false });
  assert.deepEqual(parseAmountToken('$1,234.50'), { amount: 1234.5, negative: false });
});

test('extrae movimientos con texto de Cuenta Nu y sus saldos', () => {
  const result = parseNuStatementText([
    'NU Colombia Cuenta de ahorros - Extracto',
    'Periodo 01/10/2026 - 31/10/2026',
    'Saldo inicial $ 100.000,00',
    '01/10/2026 Compra Mercado D1 -$ 25.000,00',
    '02/10/2026 Nomina Empresa ACME $ 2.500.000,00',
    'Saldo final $ 2.575.000,00',
  ]);
  assert.equal(result.compatible, true);
  assert.equal(result.product, 'cuenta_nu');
  assert.deepEqual(result.period, { start: '2026-10-01', end: '2026-10-31' });
  assert.equal(result.openingBalance, 100000);
  assert.equal(result.closingBalance, 2575000);
  assert.equal(result.movements.length, 2);
  assert.equal(result.movements[0].type, 'gasto');
  assert.equal(result.movements[0].category, 'Alimentación');
  assert.equal(result.movements[1].type, 'ingreso');
});

test('clasifica tarjeta, pagos, devoluciones, cargos y anulaciones por separado', () => {
  assert.equal(classifyMovement({ description: 'Compra Cafe', product: 'tarjeta_nu' }).type, 'gasto');
  assert.equal(classifyMovement({ description: 'Pago tarjeta de credito' }).type, 'pago_tarjeta');
  assert.equal(classifyMovement({ description: 'Devolucion compra' }).type, 'devolucion');
  assert.equal(classifyMovement({ description: 'Compra reversada' }).type, 'devolucion');
  assert.equal(classifyMovement({ description: 'Interes corriente' }).type, 'gasto');
  assert.equal(classifyMovement({ description: 'Compra anulada' }).type, 'anulada');
});

test('no convierte una transferencia recibida ambigua en ingreso', () => {
  assert.equal(classifyMovement({ description: 'Transferencia recibida', product: 'cuenta_nu' }).type, 'por_revisar');
});

test('identifica operación manual coincidente y referencia bancaria estable', () => {
  const manual = { id: 'm1', date: '2026-10-02', amount: 25000, name: 'Mercado D1' };
  const candidate = { date: '2026-10-02', amount: 25000, description: 'Compra Mercado D1' };
  assert.equal(matchPossibleDuplicates(candidate, [manual], 'cuenta_nu').length, 1);
  assert.equal(matchPossibleDuplicates({ ...candidate, date: '2026-10-03' }, [manual], 'cuenta_nu').length, 0);
  const imported = { id: 'i1', date: '2026-09-20', amount: 1, name: 'Otro', bankReference: 'REF-998822', nuProduct: 'cuenta_nu' };
  assert.equal(matchPossibleDuplicates({ ...candidate, bankReference: 'REF-998822' }, [imported], 'cuenta_nu')[0].exact, true);
});

test('advierte cuando un extracto Nu reconocido no contiene movimientos', () => {
  const result = parseNuStatementText(['Extracto Cuenta Nu Colombia', 'Periodo 01/10/2026 - 31/10/2026', 'No hubo movimientos']);
  assert.equal(result.compatible, true);
  assert.equal(result.movements.length, 0);
  assert.match(result.warnings[0], /no se detectaron movimientos/i);
});

test('rechaza texto de un documento que no identifica a Nu', () => {
  assert.equal(parseNuStatementText(['Factura de servicios', '01/10/2026 Comercio $ 1.000']).compatible, false);
});

test('reconstruye filas PDF por posición vertical y horizontal', () => {
  const lines = pdfItemsToLines([
    { str: '$ 25.000', transform: [1, 0, 0, 1, 300, 700] },
    { str: '01/10/2026', transform: [1, 0, 0, 1, 30, 700] },
    { str: 'Compra D1', transform: [1, 0, 0, 1, 100, 700] },
    { str: 'Otra fila', transform: [1, 0, 0, 1, 30, 680] },
  ]);
  assert.deepEqual(lines, ['01/10/2026 Compra D1 $ 25.000', 'Otra fila']);
});

test('parseNuStatement extrae movimientos de fechas y montos en líneas separadas', () => {
  const result = parseNuStatement([
    'Extracto Cuenta Nu Colombia',
    'Periodo 01 sep 2026 - 30 sep 2026',
    '01 sep',
    'Compra Mercado D1',
    '-$ 25.000',
    '02 sep',
    'Nomina Empresa ACME',
    '+$ 1.500.000',
  ]);

  assert.equal(result.movements.length, 2);
  assert.equal(result.movements[0].date, '2026-09-01');
  assert.equal(result.movements[0].amount, -25000);
  assert.equal(result.movements[0].type, 'gasto');
  assert.equal(result.movements[1].date, '2026-09-02');
  assert.equal(result.movements[1].amount, 1500000);
  assert.equal(result.movements[1].type, 'ingreso');
});
