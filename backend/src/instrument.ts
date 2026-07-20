/**
 * Sentry initialization — MUST be imported first, before `@nestjs/core` and the
 * app module, so the SDK can auto-instrument (docs 14 §2). `main.ts` imports this
 * as its very first line.
 *
 * A no-op when `SENTRY_DSN` is empty (local dev): we skip `init` entirely so a
 * developer machine reports nothing. Config is read straight from `process.env`
 * because this runs before Nest's ConfigModule exists.
 *
 * Policy (docs 14 §2.3/§2.4): errors 100 %, traces 10 %, `sendDefaultPii: false`,
 * and a `beforeSend` scrubber that mirrors the logging redaction contract
 * (docs 13 §13) — cookies/authorization always dropped, `/auth/*` request bodies
 * dropped, sensitive query params stripped.
 */
import * as Sentry from '@sentry/nestjs';
import type { ErrorEvent } from '@sentry/nestjs';

// Resolve file-mounted container secrets before Sentry reads its DSN (P7.1).
import './config/bootstrap-secrets';
import { isSensitiveKey } from './logger/redaction';

const dsn = process.env.SENTRY_DSN ?? '';

if (dsn !== '') {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Same sha that tags the Docker image + release (docs 14 §2.2).
    release: process.env.SENTRY_RELEASE ?? process.env.GIT_SHA,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    sendDefaultPii: false,
    integrations: [Sentry.nestIntegration()],
    beforeSend,
  });
  // Tag every event with the build/instance so errors are attributable (P7.1).
  Sentry.setTags({
    service: process.env.SERVICE_NAME ?? 'qalam-backend',
    'app.version': process.env.APP_VERSION ?? '0.0.0',
    'app.commit': (process.env.GIT_SHA ?? '').slice(0, 12),
    'app.instance': process.env.INSTANCE_ID ?? '',
    'release.channel': process.env.RELEASE_CHANNEL ?? 'dev',
  });
}

/** Scrub PII/secrets from an event before it leaves the process (docs 14 §2.4). */
function beforeSend(event: ErrorEvent): ErrorEvent {
  const request = event.request;
  if (request !== undefined) {
    // Always drop cookies + auth headers.
    delete request.cookies;
    if (request.headers !== undefined) {
      delete request.headers.authorization;
      delete request.headers.cookie;
      delete request.headers['set-cookie'];
    }
    // Drop the entire body for auth routes (credentials, tokens).
    const url = request.url ?? '';
    if (url.includes('/auth/')) {
      delete request.data;
    }
    // Strip sensitive query params.
    if (typeof request.query_string === 'string') {
      request.query_string = scrubQueryString(request.query_string);
    }
  }
  return event;
}

/** Remove sensitive params from a raw `a=1&token=x` query string. */
function scrubQueryString(qs: string): string {
  return qs
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=');
      const key = eq === -1 ? pair : pair.slice(0, eq);
      return isSensitiveKey(decodeURIComponent(key)) ? `${key}=[REDACTED]` : pair;
    })
    .join('&');
}
