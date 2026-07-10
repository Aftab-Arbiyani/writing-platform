import { env } from '@/config/env';

/**
 * Service-worker registration — ARCHITECTURE PLACEHOLDER (Epic F10).
 *
 * The Reader app ships NO active service worker and NO offline synchronization (out of F10 scope).
 * This is the single wiring point where a worker will be registered when a future PWA epic lands;
 * it is a deliberate NO-OP unless `VITE_ENABLE_SW=true` (and the browser supports SW). The worker
 * template lives at `public/sw.js`. Called once from `main.tsx`.
 */
export function registerServiceWorker(): void {
  if (env.VITE_ENABLE_SW !== 'true') return; // disabled by default — see env.ts
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      // Registration failure must never break the app — the SPA works fully without a worker.

      console.warn('[qalam] service worker registration failed', error);
    });
  });
}
