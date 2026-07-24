/* TaFit · Service Worker v8
   Cachea la app y los scripts para que abra al instante, con o sin señal. */
const CACHE = 'tafit-v8-4';
const ASSETS = [
  './',
  './index.html',
  './icon-m.png',
  './icon-f.png',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js'
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

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;
  /* nunca interceptar la base de datos en vivo */
  if (url.includes('firestore.googleapis.com') || url.includes('googleapis.com/identitytoolkit')) return;

  const cacheable = url.startsWith(self.location.origin) || url.includes('gstatic.com/firebasejs');
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
