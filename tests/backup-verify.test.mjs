import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyBackup } from '../tools/copias/verify.mjs';

const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex');
const row = (tabla, arr) => { const datos = JSON.stringify(arr); return { tabla, filas: arr.length, md5: md5(datos), datos }; };

test('una copia íntegra se verifica (incluidos acentos)', () => {
  const r = verifyBackup([row('mcc_data', [{ user_id: 'a', data: { tx: [{ name: 'Alimentación' }] } }]), row('gym_sets', [])]);
  assert.equal(r.ok, true);
});

test('detecta datos alterados, filas faltantes y archivos vacíos', () => {
  const bueno = row('gym_sets', [{ id: 1 }, { id: 2 }]);
  assert.equal(verifyBackup([{ ...bueno, datos: bueno.datos.replace('2', '3') }]).ok, false);
  assert.equal(verifyBackup([{ ...bueno, filas: 3 }]).ok, false);
  assert.equal(verifyBackup([]).ok, false);
});

test('lee el CSV del panel de Supabase (comillas, comas y saltos de línea dentro del JSON)', async () => {
  const { readBackup } = await import('../tools/copias/verify.mjs');
  const datos = JSON.stringify([{ name: 'Café, "especial"', nota: 'línea 1\nlínea 2' }]);
  const csv = '\uFEFFtabla,filas,md5,datos,exportado_en\r\n' +
    `food_logs,1,${md5(datos)},"${datos.replace(/"/g, '""')}",2026-11-15 21:30:00+00\r\n` +
    `water_logs,0,${md5('[]')},[],2026-11-15 21:30:00+00\r\n`;
  const rows = readBackup(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].datos, datos);
  assert.equal(verifyBackup(rows).ok, true);
  assert.equal(verifyBackup(readBackup(csv.replace('Café', 'Cafe'))).ok, false);
});
