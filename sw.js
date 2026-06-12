// Cache-first service worker so the game works fully offline after first load.
// Bump CACHE_VERSION on every deploy to push updates to installed clients.
const CACHE_VERSION = 'yamb-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './ui.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cached =>
      cached ||
      fetch(e.request).then(resp => {
        // Cache same-origin responses so future visits work offline too.
        if (resp.ok && new URL(e.request.url).origin === location.origin) {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, copy));
        }
        return resp;
      })
    )
  );
});
