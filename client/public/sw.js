// ════════════════════════════════════════════════════════════
//  STREAM Ecosystem — Service Worker
//  Cache-first for static assets, network-first for API calls
// ════════════════════════════════════════════════════════════

const CACHE_VERSION = 'stream-v4';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Assets to pre-cache on install (app shell)
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/logo-1.png',
];

// ── Install: pre-cache app shell ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // Activate new SW immediately
  self.skipWaiting();
});

// ── Activate: clean old caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ── Fetch: routing strategies ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // ── API calls: Network-first ──
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // ── Static assets: Cache-first ──
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Navigation requests: Network-first with offline fallback ──
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a copy of successful navigation responses
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Try cache first, then offline fallback
          return caches.match(request).then((cached) => {
            return cached || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // ── Everything else: Stale-while-revalidate ──
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ════════════════════════════════════════════════════════════
//  Caching Strategies
// ════════════════════════════════════════════════════════════

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ success: false, message: 'You are offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// ════════════════════════════════════════════════════════════
//  Helpers
// ════════════════════════════════════════════════════════════

function isStaticAsset(pathname) {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
    '.woff', '.woff2', '.ttf', '.eot', '.ico', '.json',
  ];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}
