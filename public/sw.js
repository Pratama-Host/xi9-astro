/* ================================================================
   sw.js — TKJ XI-9 | Service Worker (PWA Offline Cache)
   Versi 3.0 · Astro-compatible · Patch 2026
   - Network-first untuk navigasi HTML
   - Cache-first untuk aset statis
   - Fallback ke /offline jika jaringan gagal
   ================================================================ */
'use strict';

const CACHE_NAME = 'tkj-xi9-v3';
const OFFLINE_URL = '/offline';

// Aset yang di-precache saat SW install (path Astro: dimulai dari /)
const PRECACHE_ASSETS = [
  '/',
  OFFLINE_URL,
  '/assets/logo/logo-utama.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[SW] Precache gagal (sebagian):', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Menghapus cache lama:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Lewati request non-same-origin (CDN fonts, dll)
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigasi HTML — network-first dengan fallback ke cache lalu offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => {
          return caches.match(request).then(cached => {
            return cached || caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // Aset statis (_astro/, assets/) — cache-first
  if (url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (!res || res.status !== 200) return res;
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Request lainnya — network-first ringan
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
