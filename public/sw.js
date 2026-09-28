/* RINGFALL app shell and same-origin static game-resource cache. API and sockets are never cached. */
/* global self, caches, fetch, URL, Response */
const CACHE_NAME = 'ringfall-shell-v1';
const CORE_URLS = ['/', '/manifest.webmanifest', '/offline.html', '/favicon.svg', '/icons/ringfall-192.png', '/icons/ringfall-512.png', '/icons/ringfall-maskable-512.png', '/icons/ringfall-180.png'];
const CACHEABLE_PREFIXES = ['/assets/', '/characters/', '/venue/', '/audio/', '/archive/'];
const MAX_RUNTIME_ENTRIES = 80;
const MAX_RESOURCE_BYTES = 24 * 1024 * 1024;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_URLS);
    const shell = await cache.match('/');
    if (!shell) return;
    const html = await shell.text();
    const references = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
    await Promise.allSettled(references.map(async path => {
      const response = await fetch(path, { cache: 'reload' });
      if (response.ok && response.type === 'basic') await cache.put(path, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('ringfall-shell-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.includes('/socket')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(CACHE_NAME)).put('/', response.clone());
        return response;
      } catch {
        return (await caches.match('/')) || (await caches.match('/offline.html')) || Response.error();
      }
    })());
    return;
  }

  if (!CACHEABLE_PREFIXES.some(prefix => url.pathname.startsWith(prefix)) || /\.(?:mp4|webm|pdf|map)$/i.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    const length = Number(response.headers.get('content-length') || 0);
    if (response.ok && response.type === 'basic' && length <= MAX_RESOURCE_BYTES) {
      await cache.put(request, response.clone());
      const entries = await cache.keys();
      const runtimeEntries = entries.filter(entry => {
        const path = new URL(entry.url).pathname;
        return CACHEABLE_PREFIXES.some(prefix => path.startsWith(prefix));
      });
      for (const oldEntry of runtimeEntries.slice(0, Math.max(0, runtimeEntries.length - MAX_RUNTIME_ENTRIES))) await cache.delete(oldEntry);
    }
    return response;
  })());
});
