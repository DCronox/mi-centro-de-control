const CACHE = 'mi-centro-control-v26';
const CORE = [
  './', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  './privacidad.html', './terminos.html', './cookies.html',
  './css/app.css', './lib/supabase-2.118.0.js', './fonts/manrope-latin-wght-normal.woff2', './fonts/manrope-latin-ext-wght-normal.woff2',
  './js/theme-boot.js', './js/util.js', './js/sync-model.js', './js/store.js', './js/domain.js', './js/finance.js',
  './js/charts.js', './js/cloud-config.js', './js/push-config.js', './js/reminders-core.mjs', './js/notifications.js', './js/views/notifications.js', './js/sound.js', './js/motion.js', './js/ui.js', './js/shell.js', './js/views/dashboard.js', './js/views/money.js', './js/views/day.js',
  './js/views/goals.js', './js/views/shifts.js', './js/views/reports.js', './js/views/insights.js',
  './js/events.js', './js/cloud-auth.js', './js/sw-register.js',
  './gym.html', './css/gym.css', './js/gym/gym-data.js', './js/gym/gym-calc.js', './js/gym/gym-muscles.js', './js/gym/gym-map.js', './js/gym/gym-store.js', './js/gym/references.js', './js/gym/gym-engine.js', './js/gym/gym-nutrition.js', './js/gym/gym-foods.js', './js/gym/gym-progression.js', './js/gym/gym-recovery.js', './js/gym/gym-insights.js', './js/gym/gym-history.js', './js/gym/gym-perfil.js', './js/gym/gym-nutri-ui.js', './js/gym/gym-foods-ui.js', './js/gym/gym-progress-ui.js', './js/gym/gym-recovery-ui.js', './js/gym/gym-insights-ui.js', './js/gym/gym-history-ui.js', './js/gym/gym.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
/* ---- Notificaciones push ----
   Llegan aunque la app esté cerrada (si el navegador y el sistema lo permiten). */
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: 'Mi Centro de Control', body: event.data ? event.data.text() : '' }; }
  const title = d.title || 'Mi Centro de Control';
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: d.tag || undefined,
    renotify: false,
    data: { tab: d.tab || 'dash', id: d.id || null },
    lang: 'es-CO'
  }));
});
/* Al tocar la notificación: abre (o enfoca) la app en la sección relacionada. */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const tab = (event.notification.data && event.notification.data.tab) || 'dash';
  const id = event.notification.data && event.notification.data.id;
  const url = new URL('./index.html#' + encodeURIComponent(tab) + (id ? '&n=' + encodeURIComponent(id) : ''), self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope)) { c.postMessage({ type: 'open-tab', tab, id }); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
/* El navegador renovó la suscripción: se avisa a la app para que la guarde de nuevo. */
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => list.forEach(c => c.postMessage({ type: 'push-resubscribe' }))));
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
