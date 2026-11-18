const cachePrefix = 'basti-eats-shell-';
const cacheName = `${cachePrefix}v2`;
const shellAssets = new Set([
  '/',
  '/style.css',
  '/theme.js',
  '/app.js',
  '/identity.js',
  '/ingredient-confetti.js',
  '/request-suggestions.js',
  '/request-text.js',
  '/manifest.webmanifest',
  '/images/basti-eats-1.webp',
  '/images/basti-eats-2.webp',
  '/icons/fox-192.png',
  '/icons/fox-512.png',
  '/icons/fox-180.png',
]);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...shellAssets].map((path) => new Request(path, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function fetchAsset(request, path) {
  const cache = await caches.open(cacheName).catch(() => null);
  try {
    const response = await fetch(request);
    if (cache && response.ok) await cache.put(path, response.clone()).catch(() => {});
    return response;
  } catch {
    return (await cache?.match(path)) ?? Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const path = url.pathname === '/index.html' ? '/' : url.pathname;
  if (event.request.method === 'GET' && url.origin === self.location.origin && shellAssets.has(path)) {
    event.respondWith(fetchAsset(event.request, path));
  }
});
