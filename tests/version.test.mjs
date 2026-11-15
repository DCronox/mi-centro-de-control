import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { MCC_VERSION } = require('../js/version.js');

test('la versión sigue semver y se carga en las dos páginas y en la caché offline', () => {
  assert.match(MCC_VERSION, /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/);
  for (const f of ['index.html', 'gym.html']) {
    const h = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    assert.ok(h.includes('./js/version.js'), f + ' no carga version.js');
    assert.ok(h.includes('data-mcc-version'), f + ' no muestra la versión');
  }
  assert.ok(readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8').includes("'./js/version.js'"));
});
