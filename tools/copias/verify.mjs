#!/usr/bin/env node
// Verifica una copia exportada con tools/copias/export.sql (exportación JSON del SQL Editor de Supabase).
// Recalcula el MD5 de cada tabla y el número de filas y los compara con los que calculó la base de datos.
// Uso: node tools/copias/verify.mjs ruta/a/copia.json   → código de salida 0 si todo coincide.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export function verifyBackup(rows) {
  if (!Array.isArray(rows) || !rows.length) return { ok: false, results: [], error: 'El archivo no contiene filas.' };
  const results = rows.map((r) => {
    const datos = typeof r.datos === 'string' ? r.datos : JSON.stringify(r.datos);
    const md5 = createHash('md5').update(datos, 'utf8').digest('hex');
    let filas = null; try { filas = JSON.parse(datos).length; } catch { /* JSON dañado */ }
    const ok = md5 === r.md5 && filas === Number(r.filas);
    return { tabla: r.tabla, filas, filasEsperadas: Number(r.filas), md5Ok: md5 === r.md5, ok };
  });
  return { ok: results.every((x) => x.ok), results };
}

if (process.argv[1] && process.argv[1].endsWith('verify.mjs')) {
  const file = process.argv[2];
  if (!file) { console.error('Uso: node tools/copias/verify.mjs copia.json'); process.exit(2); }
  const { ok, results, error } = verifyBackup(JSON.parse(readFileSync(file, 'utf8')));
  if (error) { console.error(error); process.exit(1); }
  for (const r of results) console.log(`${r.ok ? 'OK   ' : 'FALLO'} ${r.tabla.padEnd(18)} ${String(r.filas).padStart(5)} filas${r.md5Ok ? '' : '  (MD5 distinto)'}${r.filas === r.filasEsperadas ? '' : `  (esperadas ${r.filasEsperadas})`}`);
  console.log(ok ? '\nCopia verificada: todas las tablas coinciden.' : '\nLa copia NO es fiable: hay tablas que no coinciden.');
  process.exit(ok ? 0 : 1);
}
