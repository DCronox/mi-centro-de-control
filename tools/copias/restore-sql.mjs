#!/usr/bin/env node
// Genera el SQL para RESTAURAR una copia (tools/copias/export.sql) en un proyecto de Supabase VACÍO (staging).
// Uso: node tools/copias/restore-sql.mjs copia.csv restaurar.sql limpiar.sql
// - Comprueba antes la integridad de la copia (MD5 y filas); si falla, no genera nada.
// - El SQL resultante contiene datos personales: guárdalo FUERA del repositorio, como la copia.
// - Al final, el propio SQL recalcula el MD5 de cada tabla como export.sql y lo compara con la copia.
// Este programa no muestra ningún dato de la copia: solo nombres de tabla y número de filas.
import { readFileSync, writeFileSync } from 'node:fs';
import { readBackup, verifyBackup } from './verify.mjs';

/* Orden de inserción (respeta las claves foráneas) y expresión de exportación de cada tabla (igual que export.sql). */
export const TABLES = [
  ['auth_users', 'id'], ['mcc_data', 'user_id'], ['notifications', 'id'], ['gym_exercises', 'id'],
  ['gym_routines', 'id'], ['gym_sessions', 'id'], ['gym_sets', 'id'], ['body_metrics', 'id'],
  ['gym_profiles', 'user_id'], ['nutrition_targets', 'id'], ['gym_audit', 'id'], ['food_logs', 'id'],
  ['water_logs', 'id'], ['food_custom', 'id'], ['recovery_logs', 'id'],
];
const IDENTITY = new Set(['notifications', 'gym_audit']); // columnas id «generated always»
const AUDIT_TRIGGERS = [['gym_profiles', 'gym_profiles_audit'], ['nutrition_targets', 'nutrition_targets_audit']];
const ident = (s) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`Nombre de columna no válido: ${s}`); return s; };
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

function dollarTag(text) {
  for (let i = 0; ; i++) { const tag = `$mcc${i}$`; if (!text.includes(tag)) return tag; }
}

/* Expresión que recalcula el texto exportado de una tabla, usando solo las columnas que tenía la copia
   (así una columna añadida después, como el consentimiento de Gym, no altera la comparación). */
function exportExpr(tabla, order, cols) {
  const src = tabla === 'auth_users' ? 'auth.users' : `public.${tabla}`;
  const list = cols?.length ? cols.map(ident).join(', ') : (tabla === 'auth_users' ? 'id, email, created_at, email_confirmed_at, raw_user_meta_data' : '*');
  return `(select coalesce(json_agg(x order by x.${order}), '[]') from (select ${list} from ${src}) x)::text`;
}

export function buildRestoreSql(rows) {
  const check = verifyBackup(rows);
  if (!check.ok) throw new Error('La copia no supera la verificación de integridad: no se genera la restauración.');
  const byName = new Map(rows.map((r) => [r.tabla, r]));
  const missing = TABLES.map(([t]) => t).filter((t) => !byName.has(t));
  if (missing.length) throw new Error(`Faltan tablas en la copia: ${missing.join(', ')}`);

  const out = [];
  out.push('-- MCC · Restauración de prueba en STAGING. Contiene datos personales: no lo subas a GitHub ni a chats.');
  out.push('-- Ejecutar en un proyecto VACÍO con las migraciones aplicadas. Todo o nada: si algo falla, no queda nada a medias.');
  out.push(`do $chk$ begin
  if exists (select 1 from auth.users) or exists (select 1 from public.mcc_data) then
    raise exception 'El proyecto no está vacío: la restauración de prueba solo se hace sobre un staging sin usuarios.';
  end if;
end $chk$;`);
  for (const [t, trg] of AUDIT_TRIGGERS) out.push(`alter table public.${t} disable trigger ${trg};`);

  const colsOf = new Map();
  for (const [tabla] of TABLES) {
    const datos = typeof byName.get(tabla).datos === 'string' ? byName.get(tabla).datos : JSON.stringify(byName.get(tabla).datos);
    const parsed = JSON.parse(datos);
    colsOf.set(tabla, parsed.length ? Object.keys(parsed[0]) : null);
    if (!parsed.length) continue;
    const tag = dollarTag(datos);
    if (tabla === 'auth_users') {
      out.push(`insert into auth.users (id, email, created_at, email_confirmed_at, raw_user_meta_data, aud, role, updated_at)
select id, email, created_at, email_confirmed_at, raw_user_meta_data, 'authenticated', 'authenticated', created_at
from json_to_recordset(${tag}${datos}${tag}::json) as x(id uuid, email text, created_at timestamptz, email_confirmed_at timestamptz, raw_user_meta_data jsonb);`);
    } else {
      const cols = colsOf.get(tabla).map(ident).join(', ');
      out.push(`insert into public.${tabla} (${cols})${IDENTITY.has(tabla) ? ' overriding system value' : ''}
select ${cols} from json_populate_recordset(null::public.${tabla}, ${tag}${datos}${tag}::json);`);
    }
  }
  for (const t of IDENTITY) out.push(`select setval(pg_get_serial_sequence('public.${t}', 'id'), coalesce((select max(id) from public.${t}), 0) + 1, false);`);
  for (const [t, trg] of AUDIT_TRIGGERS) out.push(`alter table public.${t} enable trigger ${trg};`);

  const actual = TABLES.map(([t, o]) => `  select ${lit(t)}, ${exportExpr(t, o, colsOf.get(t))}`).join('\n  union all\n');
  const expected = TABLES.map(([t]) => `(${lit(t)}, ${Number(byName.get(t).filas)}, ${lit(byName.get(t).md5)})`).join(',\n  ');
  out.push(`-- Verificación: mismo cálculo que export.sql, comparado con la copia.
with t(tabla, datos) as (
${actual}
), esperado(tabla, filas, md5) as (values
  ${expected}
)
select e.tabla, e.filas as filas_copia, json_array_length(t.datos::json) as filas_restauradas,
  case when md5(t.datos) = e.md5 then 'OK' else 'FALLO' end as resultado
from esperado e join t using (tabla)
union all
select '=== RESUMEN ===', null, null,
  (select count(*) filter (where md5(t.datos) = e.md5) || ' de ' || count(*) || ' tablas idénticas a la copia' from esperado e join t using (tabla))
order by 1;`);
  return out.join('\n\n') + '\n';
}

export function buildCleanupSql(rows) {
  const users = JSON.parse(rows.find((r) => r.tabla === 'auth_users').datos);
  const ids = users.map((u) => lit(u.id)).join(', ') || "'00000000-0000-0000-0000-000000000000'";
  return `-- MCC · Borra de STAGING los datos restaurados en la prueba (las tablas con user_id caen en cascada).
-- Nunca ejecutar en producción.
do $chk$ begin
  if not exists (select 1 from auth.users where id in (${ids})) then raise exception 'No hay datos restaurados que borrar.'; end if;
end $chk$;
delete from public.gym_audit where user_id in (${ids});
delete from auth.users where id in (${ids});
select (select count(*) from auth.users) as usuarios_restantes, (select count(*) from public.mcc_data) as filas_mcc_data;
`;
}

if (process.argv[1] && process.argv[1].endsWith('restore-sql.mjs')) {
  const [file, outFile, cleanFile] = process.argv.slice(2);
  if (!file || !outFile || !cleanFile) { console.error('Uso: node tools/copias/restore-sql.mjs copia.csv restaurar.sql limpiar.sql'); process.exit(2); }
  const rows = readBackup(readFileSync(file, 'utf8'));
  writeFileSync(outFile, buildRestoreSql(rows));
  writeFileSync(cleanFile, buildCleanupSql(rows));
  for (const [t] of TABLES) console.log(`${t.padEnd(18)} ${String(rows.find((r) => r.tabla === t).filas).padStart(5)} filas`);
  console.log(`\nGenerados: ${outFile} y ${cleanFile}`);
}
