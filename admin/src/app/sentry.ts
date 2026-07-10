import * as Sentry from '@sentry/react';

import { env } from '@/config/env';

/**
 * Telemetry init (docs/00 §9) — a no-op without a DSN, so local/dev runs stay quiet. Called once
 * from `main.tsx` before render so early errors are captured.
 */
export function initSentry(): void {
  if (!env.VITE_SENTRY_DSN) return;
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: env.VITE_APP_ENV,
  });
}

/** Report a caught render error (wired into the global ErrorBoundary's `onError`). */
export function reportError(error: unknown): void {
  Sentry.captureException(error);
}
