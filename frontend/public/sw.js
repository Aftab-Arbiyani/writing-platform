/*
 * Qalam service worker — ARCHITECTURE PLACEHOLDER (Epic F10).
 *
 * This file is NOT registered by default. The app ships no offline synchronization (out of the
 * F10 scope). It documents the intended worker shape for a future PWA epic and is only activated
 * when `VITE_ENABLE_SW=true` (see src/pwa/service-worker-registration.ts).
 *
 * Planned strategy when PWA support lands:
 *   - Precache the app shell (index.html, JS/CSS chunks) via a build-time manifest (Workbox).
 *   - Network-first for navigations, falling back to /offline.html when the network is unreachable.
 *   - Stale-while-revalidate for static assets (fonts, icons, images).
 *   - NEVER cache authenticated API responses (envelope data lives in TanStack Query, in memory).
 *
 * The no-op handlers below make the worker safe to register today without altering behaviour.
 */

const OFFLINE_URL = '/offline.html';
const CACHE = 'qalam-shell-v1';

self.addEventListener('install', (event) => {
  // Pre-cache only the offline fallback so a future network-first navigation can degrade to it.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Placeholder: only handle navigation requests, falling back to the offline page. All other
  // requests pass through to the network unchanged (no asset caching yet).
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
