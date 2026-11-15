import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyBackup } from '../tools/backup/verify.mjs';

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
