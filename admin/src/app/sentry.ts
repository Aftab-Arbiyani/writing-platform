import * as Sentry from '@sentry/react';

import { env } from '@/config/env';

/**
 * Telemetry init (docs/00 §9) — a no-op without a DSN, so local/dev runs stay quiet. Called once
 * from `main.tsx` before render so early errors are captured.
 */
/** Strips the query string from a URL so search terms/emails never reach Sentry. */
function stripQuery(url: string | undefined): string | undefined {
  if (url === undefined) return url;
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
}

export function initSentry(): void {
  if (!env.VITE_SENTRY_DSN) return;
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: env.VITE_APP_ENV,
    // Never send cookies/headers/IP; the in-memory Bearer token is never captured.
    sendDefaultPii: false,
    // Filter values (e.g. an email typed into a search box) ride in query strings —
    // strip them from fetch/navigation breadcrumbs so no PII lands in telemetry
    // (CLAUDE.md rule #9: never log tokens/passwords/emails).
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data?.url !== undefined) {
        breadcrumb.data.url = stripQuery(breadcrumb.data.url as string);
      }
      return breadcrumb;
    },
    beforeSend(event) {
      if (event.request?.url !== undefined) {
        event.request.url = stripQuery(event.request.url);
      }
      return event;
    },
  });
}

/** Report a caught render error (wired into the global ErrorBoundary's `onError`). */
export function reportError(error: unknown): void {
  Sentry.captureException(error);
}
