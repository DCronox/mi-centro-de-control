// Devuelve el código de la app concatenado en el mismo orden en que index.html carga sus scripts.
// Se excluyen las librerías de terceros (lib/).
import fs from 'node:fs';

const rootUrl = new URL('../../', import.meta.url);

export function appScripts() {
  const html = fs.readFileSync(new URL('index.html', rootUrl), 'utf8');
  return [...html.matchAll(/<script src="\.\/([^"]+)"><\/script>/g)]
    .map(m => m[1])
    .filter(p => p.startsWith('js/'));
}

export function appSource() {
  return appScripts().map(p => fs.readFileSync(new URL(p, rootUrl), 'utf8')).join('\n');
}
