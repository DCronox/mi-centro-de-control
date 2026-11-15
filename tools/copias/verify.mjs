#!/usr/bin/env node
// Verifica una copia exportada con tools/copias/export.sql desde el SQL Editor de Supabase
// («Export › Download CSV» o un JSON con las mismas columnas).
// Recalcula el MD5 de cada tabla y el número de filas y los compara con los que calculó la base de datos.
// Uso: node tools/copias/verify.mjs ruta/a/copia.csv   → código de salida 0 si todo coincide.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

/* CSV según RFC 4180: comillas dobles, comillas escapadas ("") y saltos de línea dentro de campos. */
export function parseCsv(text) {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // sin BOM
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return (body || []).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i]])));
}

/* Lee el archivo exportado: JSON (lista de filas) o CSV. */
export function readBackup(text) {
  const t = text.replace(/^﻿/, '').trimStart();
  return t.startsWith('[') ? JSON.parse(t) : parseCsv(text);
}

export function verifyBackup(rows) {
  if (!Array.isArray(rows) || !rows.length) return { ok: false, results: [], error: 'El archivo no contiene filas.' };
  const results = rows.map((r) => {
    const datos = typeof r.datos === 'string' ? r.datos : JSON.stringify(r.datos);
    const md5 = createHash('md5').update(datos ?? '', 'utf8').digest('hex');
    let filas = null; try { filas = JSON.parse(datos).length; } catch { /* JSON dañado o recortado */ }
    const ok = md5 === r.md5 && filas === Number(r.filas);
    return { tabla: r.tabla, filas, filasEsperadas: Number(r.filas), md5Ok: md5 === r.md5, ok };
  });
  return { ok: results.every((x) => x.ok), results };
}

if (process.argv[1] && process.argv[1].endsWith('verify.mjs')) {
  const file = process.argv[2];
  if (!file) { console.error('Uso: node tools/copias/verify.mjs copia.csv'); process.exit(2); }
  const { ok, results, error } = verifyBackup(readBackup(readFileSync(file, 'utf8')));
  if (error) { console.error(error); process.exit(1); }
  for (const r of results) console.log(`${r.ok ? 'OK   ' : 'FALLO'} ${String(r.tabla).padEnd(18)} ${String(r.filas).padStart(5)} filas${r.md5Ok ? '' : '  (MD5 distinto)'}${r.filas === r.filasEsperadas ? '' : `  (esperadas ${r.filasEsperadas})`}`);
  console.log(ok ? `\nCopia verificada: las ${results.length} tablas coinciden.` : '\nLa copia NO es fiable: hay tablas que no coinciden.');
  process.exit(ok ? 0 : 1);
}
