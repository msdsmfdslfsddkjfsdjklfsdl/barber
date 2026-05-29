// Barber 16 service worker — installable PWA + offline shell.
// Cache-first for all local app files, including the vendored React/Babel in
// vendor/, so the app loads instantly and works fully offline.
const CACHE = 'barber-16-v5';
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
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  // App shell (html / jsx / manifest / navigations): network-first so updates
  // appear immediately when online; fall back to cache when offline.
  const isShell = sameOrigin && (request.mode === 'navigate' || url.pathname.endsWith('/') ||
                  /\.(?:html|jsx|webmanifest)$/.test(url.pathname));
  if (isShell) {
    event.respondWith(
      fetch(request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return resp;
      }).catch(() => caches.match(request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }
  // Static deps (vendor, icons) + opaque CDN: cache-first for speed + offline.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => cached))
  );
});
