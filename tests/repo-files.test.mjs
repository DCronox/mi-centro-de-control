import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Evita que una prueba pase en local pero falle en CI porque el archivo que usa está excluido por .gitignore
// (ocurrió con tools/backup/, que coincidía con la regla «backup/» que protege las copias personales).
test('todo archivo que importan las pruebas está en Git', () => {
  const root = new URL('../', import.meta.url);
  let tracked;
  try { tracked = new Set(execSync('git -c safe.directory=* ls-files', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)); }
  catch { return; } // sin Git (por ejemplo, una copia descargada como ZIP) no se puede comprobar
  const missing = [];
  for (const f of readdirSync(new URL('tests/', root)).filter((x) => x.endsWith('.mjs'))) {
    for (const m of readFileSync(new URL('tests/' + f, root), 'utf8').matchAll(/['"]\.\.\/([^'"]+\.(?:m?js|json|html|sql))['"]/g)) {
      if (!tracked.has(m[1])) missing.push(`${m[1]} (usado en tests/${f})`);
    }
  }
  assert.deepEqual(missing, [], 'Archivos usados por pruebas que Git no sigue (¿.gitignore?)');
});
