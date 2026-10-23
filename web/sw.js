const CACHE = 'syllune-v1.0.1-typed-entry';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './fonts.css',
  './app.js',
  './engine.js',
  './ink.js',
  './quiet-ink.js',
  './practice.js',
  './storage.js',
  './icon.svg',
  './manifest.webmanifest',
];
self.addEventListener('install', (e) =>
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS))),
);
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('syllune-') && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (
    e.request.method !== 'GET' ||
    u.origin !== location.origin ||
    u.pathname.includes('/api/')
  )
    return;
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then(
        (r) =>
          r ||
          new Response('This resource is unavailable offline.', {
            status: 503,
          }),
      ),
    ),
  );
});
