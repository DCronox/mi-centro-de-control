import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { TABLES, buildRestoreSql, buildCleanupSql } from '../tools/copias/restore-sql.mjs';

const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex');
const row = (tabla, arr) => { const datos = JSON.stringify(arr); return { tabla, filas: arr.length, md5: md5(datos), datos }; };
const U = '00000000-0000-4000-8000-0000000000aa';
const copia = (extra = {}) => TABLES.map(([t]) => row(t, extra[t] ?? []));

test('restaura en orden de claves foráneas, respeta identidades y desactiva la auditoría', () => {
  const sql = buildRestoreSql(copia({
    auth_users: [{ id: U, email: 'x@example.test', created_at: '2026-01-01T00:00:00+00:00', email_confirmed_at: null, raw_user_meta_data: {} }],
    mcc_data: [{ user_id: U, data: { a: 1 }, updated_at: '2026-01-01T00:00:00+00:00' }],
    notifications: [{ id: 7, user_id: U }],
    gym_profiles: [{ user_id: U, sex: 'x' }],
  }));
  assert.ok(sql.indexOf('insert into auth.users') < sql.indexOf('insert into public.mcc_data'));
  assert.match(sql, /insert into public\.notifications \(id, user_id\) overriding system value/);
  assert.match(sql, /disable trigger gym_profiles_audit[\s\S]*enable trigger gym_profiles_audit/);
  assert.match(sql, /setval\(pg_get_serial_sequence\('public\.gym_audit', 'id'\)/);
  // La verificación usa solo las columnas de la copia (ignora columnas añadidas después).
  assert.match(sql, /select user_id, sex from public\.gym_profiles/);
  // Tablas vacías: sin INSERT, pero sí en la verificación.
  assert.doesNotMatch(sql, /insert into public\.gym_sets/);
  for (const [t] of TABLES) assert.ok(sql.includes(`('${t}', `), `falta ${t} en la verificación`);
  assert.match(sql, /El proyecto no está vacío/);
});

test('el delimitador no choca con el contenido y se rechazan copias alteradas', () => {
  const sql = buildRestoreSql(copia({ mcc_data: [{ user_id: U, data: { nota: 'contiene $mcc0$ y \'comillas\'' } }] }));
  assert.match(sql, /\$mcc1\$\[/);
  const mala = copia(); mala[1] = { ...mala[1], md5: md5('otra cosa') };
  assert.throws(() => buildRestoreSql(mala), /integridad/);
  assert.throws(() => buildRestoreSql(copia().slice(1)), /Faltan tablas/);
});

test('la limpieza solo borra las cuentas de la copia', () => {
  const sql = buildCleanupSql(copia({ auth_users: [{ id: U }] }));
  assert.match(sql, new RegExp(`delete from auth\\.users where id in \\('${U}'\\)`));
});
