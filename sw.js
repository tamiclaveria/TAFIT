/* TaFit · Service Worker v8
   Cachea la app y los scripts para que abra al instante, con o sin señal.
   07/10/2026 — actualización rápida:
   1) al instalar una versión nueva, los archivos propios se bajan SIN pasar por la caché
      del navegador (cache:'reload'). Antes podía quedar guardado el index.html VIEJO dentro
      de la versión nueva, y la app seguía mostrando lo anterior.
   2) la página (index.html) se pide primero a la red, con un límite de 3 segundos; si no hay
      señal o tarda, se abre la copia guardada. Así, con señal, siempre se ve la última
      versión publicada, y sin señal la app sigue abriendo igual que antes. */
const CACHE = 'tafit-v8-126';
const ASSETS = [
  './',
  './index.html',
  './icon-app-192.png',
  './icon-app-512.png',
  './apple-touch-icon-180.png',
  './logo-principal.png',
  './favicon.ico',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];
const NET_TIMEOUT_MS = 3000;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* al tocar el recordatorio, enfoca la app si ya está abierta o abre una pestaña nueva */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});

function isPage(req) {
  if (req.mode === 'navigate') return true;
  const u = new URL(req.url);
  return u.origin === self.location.origin && (u.pathname.endsWith('/') || u.pathname.endsWith('/index.html'));
}

/* red primero (máx 3 s) para la página; si falla o tarda, la copia guardada */
function pageNetworkFirst(req) {
  return caches.open(CACHE).then(c => {
    const fromCache = () => c.match(req, { ignoreSearch: true }).then(h => h || c.match('./index.html')).then(h => h || c.match('./'));
    const net = fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })).then(r => {
      if (r && r.ok) { c.put('./index.html', r.clone()); }
      return r;
    });
    return new Promise(resolve => {
      let settled = false;
      const t = setTimeout(() => { fromCache().then(h => { if (!settled && h) { settled = true; resolve(h); } }); }, NET_TIMEOUT_MS);
      net.then(r => { if (!settled && r && r.ok) { settled = true; clearTimeout(t); resolve(r); } else throw new Error('bad'); })
        .catch(() => fromCache().then(h => { if (!settled) { settled = true; clearTimeout(t); resolve(h || Response.error()); } }));
    });
  });
}

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;
  /* nunca interceptar la base de datos en vivo */
  if (url.includes('firestore.googleapis.com') || url.includes('googleapis.com/identitytoolkit')) return;

  const cacheable = url.startsWith(self.location.origin) || url.includes('gstatic.com/firebasejs') || url.includes('cdnjs.cloudflare.com');
  if (!cacheable) return;

  if (isPage(e.request)) { e.respondWith(pageNetworkFirst(e.request)); return; }

  /* resto (íconos, scripts): cache primero (velocidad + offline), y actualiza por detrás */
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(r => {
        if (r && r.ok) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return r;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
