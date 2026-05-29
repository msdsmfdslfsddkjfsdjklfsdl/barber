// Service worker — Barber 16 booking site (standalone, offline shell).
const CACHE = 'barber-16-site-v2';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './vendor/react.production.min.js', './vendor/react-dom.production.min.js', './vendor/babel.min.js',
  './src/data.jsx', './src/ui.jsx', './src/customer-flow.jsx', './src/queue-tracker.jsx',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  // App shell (html / jsx / manifest / navigations): network-first so updates
  // appear immediately when online; fall back to cache when offline.
  const isShell = sameOrigin && (req.mode === 'navigate' || url.pathname.endsWith('/') ||
                  /\.(?:html|jsx|webmanifest)$/.test(url.pathname));
  if (isShell) {
    e.respondWith(
      fetch(req).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return resp;
      }).catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }
  // Static deps (vendor, icons) + opaque CDN: cache-first.
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((resp) => {
      const copy = resp.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return resp;
    }).catch(() => cached))
  );
});
