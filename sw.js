const VERSION = 'michi-v1';
const CORE = [
  './',
  './index.html',
  './pyq.html',
  './index-3.html',
  './support.js',
  './pyq-data.json',
  './manifest.webmanifest',
  './assets/fonts/nunito.css',
  './assets/fonts/nunito-0.woff2',
  './assets/fa/css/all.min.css',
  './assets/fa/webfonts/fa-solid-900.woff2',
  './assets/fa/webfonts/fa-regular-400.woff2',
  './assets/vendor/d3.v7.min.js',
  './assets/vendor/topojson-client.v3.min.js',
  './assets/vendor/react.min.js',
  './assets/vendor/react-dom.min.js',
  './assets/vendor/babel.min.js',
  './assets/data/countries-110m.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for same-origin navigations and content (fresh on every push),
// cache fallback offline. Runtime-cache big remote map data after first fetch.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && (url.origin === location.origin || url.hostname.endsWith('githubusercontent.com') || url.hostname === 'cdn.jsdelivr.net')) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() =>
      caches.match(e.request, { ignoreSearch: true }).then(hit => hit || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
    )
  );
});
