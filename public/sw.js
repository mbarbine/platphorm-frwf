/* RINGFALL app shell and same-origin static game-resource cache. API and sockets are never cached. */
/* global self, caches, fetch, URL, Response, Headers */
const CACHE_NAME = 'ringfall-shell-v1';
const CORE_URLS = ['/', '/manifest.webmanifest', '/offline.html', '/favicon.svg', '/icons/ringfall-192.png', '/icons/ringfall-512.png', '/icons/ringfall-maskable-512.png', '/icons/ringfall-180.png'];
const CACHEABLE_PREFIXES = ['/assets/', '/characters/', '/venue/', '/audio/', '/archive/'];
const MAX_RUNTIME_ENTRIES = 80;
const MAX_RUNTIME_BYTES = 96 * 1024 * 1024;
const MAX_RESOURCE_BYTES = 24 * 1024 * 1024;
const CORE_ASSET_INDEX = '/__ringfall_core_assets__';

async function cacheMeasuredAsset(cache, request, response) {
  const body = await response.clone().arrayBuffer();
  const size = body.byteLength;
  if (size === 0 || size > MAX_RESOURCE_BYTES) return 0;
  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.delete('content-range');
  // Cache entries are written using URL-only requests during install. Keeping
  // Vary (usually accept-encoding from the CDN) makes browser requests miss.
  headers.delete('vary');
  headers.set('X-Ringfall-Cache-Bytes', String(size));
  await cache.put(request, new Response(body, { status: response.status, statusText: response.statusText, headers }));
  return size;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_URLS);
    const shell = await cache.match('/');
    if (!shell) return;
    const html = await shell.text();
    const references = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
    await cache.put(CORE_ASSET_INDEX, new Response(JSON.stringify(references), { headers: { 'Content-Type': 'application/json' } }));
    await Promise.allSettled(references.map(async path => {
      const response = await fetch(path, { cache: 'reload' });
      if (response.ok && response.type === 'basic') await cacheMeasuredAsset(cache, path, response);
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
        if (response.ok) {
          const headers = new Headers(response.headers);
          headers.delete('vary');
          (await caches.open(CACHE_NAME)).put('/', new Response(await response.clone().arrayBuffer(), {
            status: response.status,
            statusText: response.statusText,
            headers,
          }));
        }
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
    if (response.ok && response.type === 'basic') {
      const newSize = await cacheMeasuredAsset(cache, request, response);
      if (newSize === 0) return response;
      const entries = await cache.keys();
      const runtimeEntries = entries.filter(entry => {
        const path = new URL(entry.url).pathname;
        return CACHEABLE_PREFIXES.some(prefix => path.startsWith(prefix));
      });
      const coreResponse = await cache.match(CORE_ASSET_INDEX);
      const coreAssets = new Set(coreResponse ? await coreResponse.json() : []);
      const sizes = await Promise.all(runtimeEntries.map(async entry => {
        const cachedResponse = await cache.match(entry);
        return Number(cachedResponse?.headers.get('X-Ringfall-Cache-Bytes') || cachedResponse?.headers.get('content-length') || 0);
      }));
      let count = runtimeEntries.length;
      let bytes = sizes.reduce((sum, size) => sum + size, 0);
      for (let index = 0; index < runtimeEntries.length && (count > MAX_RUNTIME_ENTRIES || bytes > MAX_RUNTIME_BYTES); index++) {
        const entry = runtimeEntries[index];
        if (entry && coreAssets.has(new URL(entry.url).pathname)) continue;
        if (entry && await cache.delete(entry)) {
          count--;
          bytes -= sizes[index] || 0;
        }
      }
    }
    return response;
  })());
});
