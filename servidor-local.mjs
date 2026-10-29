import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'], ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'], ['.json', 'application/json; charset=utf-8'],
]);

http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Solicitud inválida'); return; }
  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403).end('Acceso denegado'); return; }
  fs.stat(file, (statError, stat) => {
    if (statError || !stat.isFile()) { response.writeHead(404).end('No encontrado'); return; }
    response.writeHead(200, { 'Content-Type': mime.get(path.extname(file).toLowerCase()) || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });
}).listen(8765, '127.0.0.1', () => console.log('Mi Centro de Control está disponible en http://localhost:8765/ (solo en este equipo). Pulsa Ctrl+C para cerrar.'));
