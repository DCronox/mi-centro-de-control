import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Los scripts de gym.html comparten el ámbito global: un nombre declarado dos veces rompe la página entera.
test('gym.html no declara dos veces el mismo nombre global', () => {
  const html = readFileSync(new URL('../gym.html', import.meta.url), 'utf8');
  const files = [...html.matchAll(/<script src="\.\/(js\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(files.length > 8);
  const seen = new Map(), dups = [];
  for (const f of files) {
    const src = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    for (const m of src.matchAll(/^(?:const|let|class|function|async function)\s+([A-Za-z_$][\w$]*)/gm)) {
      const n = m[1];
      if (seen.has(n) && seen.get(n) !== f) dups.push(`${n}: ${seen.get(n)} y ${f}`);
      else seen.set(n, f);
    }
  }
  assert.deepEqual(dups, []);
});
