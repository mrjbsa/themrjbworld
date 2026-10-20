// The Mr JB World — minimal service worker (app-shell caching for installability + basic offline support)
const CACHE_NAME = 'mjbw-shell-v10';
const SHELL_FILES = [
  './',
  './index.html',
  './style.css?v=16',
  './script.js?v=16',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(SHELL_FILES.map((u) => cache.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for navigations (so visitors always get the latest cloud data when online),
// falling back to the cached shell when offline. Cache-first for the site's own static assets.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (isSameOrigin && url.pathname.endsWith('/videos.json')) {
    event.respondWith(fetch(request));   // always fresh, never cached
    return;
  }

  if (isSameOrigin) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return res;
      }).catch(() => cached))
    );
  }
  // Cross-origin requests (Google Drive, fonts, icons CDN) are left to the network as-is.
});
