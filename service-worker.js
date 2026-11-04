const CACHE = 'mi-centro-control-v11';
const CORE = [
  './', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  './privacidad.html', './terminos.html', './cookies.html',
  './css/app.css', './lib/supabase-2.118.0.js', './fonts/manrope-latin-wght-normal.woff2', './fonts/manrope-latin-ext-wght-normal.woff2',
  './js/theme-boot.js', './js/util.js', './js/sync-model.js', './js/store.js', './js/domain.js', './js/finance.js',
  './js/charts.js', './js/ui.js', './js/shell.js', './js/views/dashboard.js', './js/views/money.js', './js/views/day.js',
  './js/views/goals.js', './js/views/shifts.js', './js/views/reports.js', './js/views/insights.js',
  './js/events.js', './js/cloud-auth.js', './js/sw-register.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    const isApp = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
    event.respondWith(fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(isApp ? './index.html' : request, copy));
      }
      return response;
    }).catch(() => caches.match(request).then(hit => hit || caches.match('./index.html'))));
    return;
  }
  // Código de la app (CSS/JS): red primero para recibir correcciones; caché si no hay conexión.
  if (/\/(js|css)\//.test(url.pathname)) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
      return response;
    }).catch(() => caches.match(request)));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
    return response;
  })));
});
