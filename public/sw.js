/* Reef Crush service worker — makes the game installable and playable offline.
   Bump VERSION whenever any file in APP_SHELL changes so players get the update. */
const VERSION = 'reef-crush-v1.1.0';
const SHELL_CACHE = `${VERSION}-shell`;
const FONT_CACHE = 'reef-crush-fonts';

const APP_SHELL = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/engine.js',
  '/js/levels.js',
  '/js/game.js',
  '/js/pwa.js',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // cache: 'reload' skips the HTTP cache so a new version never precaches stale files.
      .then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Page loads: try the network for the freshest page, fall back to the cached game offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then(c => c.put('/index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Google Fonts: cache-first, so the game keeps its font offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(req).then(hit => hit || fetch(req).then(res => {
          if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // Game files: serve from cache instantly, refresh the cache in the background.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(cache =>
        cache.match(req, { ignoreSearch: true }).then(hit => {
          const network = fetch(req).then(res => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => hit);
          return hit || network;
        })
      )
    );
  }
});
