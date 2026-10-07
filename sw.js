/* TaFit · Service Worker v8
   Cachea la app y los scripts para que abra al instante, con o sin señal. */
const CACHE = 'tafit-v8-101';
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
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
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

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;
  /* nunca interceptar la base de datos en vivo */
  if (url.includes('firestore.googleapis.com') || url.includes('googleapis.com/identitytoolkit')) return;

  const cacheable = url.startsWith(self.location.origin) || url.includes('gstatic.com/firebasejs') || url.includes('cdnjs.cloudflare.com');
  if (!cacheable) return;

  /* cache primero (velocidad + offline), y actualiza por detrás */
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
