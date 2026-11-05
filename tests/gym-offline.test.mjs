import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

// Gym debe abrir sin conexión: todo lo que carga gym.html tiene que estar en la caché del service worker.
const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('gym.html', root), 'utf8');
const sw = readFileSync(new URL('service-worker.js', root), 'utf8');
const core = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);

test('todo script y hoja de estilo de gym.html está en la caché offline y existe', () => {
  const assets = [...html.matchAll(/(?:src|href)="\.\/([^"#?]+\.(?:js|css))"/g)].map((m) => m[1]);
  assert.ok(assets.length > 15);
  const missing = assets.filter((a) => !core.includes(a));
  assert.deepEqual(missing, [], 'faltan en la caché del service worker');
  for (const a of assets) assert.ok(existsSync(new URL(a, root)), 'no existe ' + a);
});

test('cada módulo de js/gym está cargado en gym.html', () => {
  const mods = readdirSync(new URL('js/gym/', root)).filter((f) => f.endsWith('.js'));
  const notLoaded = mods.filter((f) => !html.includes(`./js/gym/${f}`));
  assert.deepEqual(notLoaded, []);
});
