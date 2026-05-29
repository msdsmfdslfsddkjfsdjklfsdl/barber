// Fade City service worker — installable PWA + offline shell.
// Cache-first for the local app files; CDN deps (React/Babel from unpkg) are
// cached opaquely on first online load so the app keeps working offline.
const CACHE = 'fade-city-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './vendor/react.production.min.js',
  './vendor/react-dom.production.min.js',
  './vendor/babel.min.js',
  './tweaks-panel.jsx',
  './design-canvas.jsx',
  './ios-frame.jsx',
  './src/data.jsx',
  './src/ui.jsx',
  './src/customer-flow.jsx',
  './src/queue-tracker.jsx',
  './src/barber-app.jsx',
  './src/barber-fast.jsx',
  './src/app.jsx',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((resp) => {
          // Stash a copy (same-origin + opaque CDN responses) for offline reuse.
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return resp;
        })
        .catch(() => cached);
    })
  );
});
