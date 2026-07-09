import * as Sentry from '@sentry/react';

import { env } from '@/config/env';

/**
 * Initialize Sentry (docs/00 §9) — no-op without a DSN. Release-tagged sourcemaps are
 * uploaded by the build (vite sourcemap: true). PII off; id-only user in later epics.
 */
export function initSentry(): void {
  if (!env.VITE_SENTRY_DSN) return;
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: env.VITE_APP_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

/** Report a caught error to Sentry (no-op without a DSN). */
export function reportError(error: unknown): void {
  if (env.VITE_SENTRY_DSN) Sentry.captureException(error);
}
