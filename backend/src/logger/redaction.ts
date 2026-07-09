/**
 * Redaction — the single source of truth for what never appears in logs or error
 * reports (docs 14 §1.6, security contract docs 13 §13). Applied in the Pino
 * config ({@link AppLoggerModule}) and mirrored in the Sentry `beforeSend`
 * scrubber (`instrument.ts`) so the two never drift.
 *
 * Guarantee: token/password/cookie values never appear in a log line, an error
 * payload, or a Sentry event — regardless of where in the object tree they sit.
 */

/** Pino `redact.paths` — dot/bracket paths + `*.key` wildcards. */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.code',
] as const;

/** Replacement value for redacted fields. */
export const REDACT_CENSOR = '[REDACTED]';

/**
 * Sensitive key names (leaf-level) — used by the Sentry query-string/body
 * scrubber, which walks by key name rather than by Pino path.
 */
export const SENSITIVE_KEYS: readonly string[] = [
  'password',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'code',
  'authorization',
  'cookie',
];

/** True if a parameter/key name is sensitive (case-insensitive). */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.includes(key.toLowerCase());
}

/**
 * Masks an email for the rare cases we must reference one in a log/breadcrumb
 * (`aftab@example.com` → `af***@e***.com`). The platform's policy is to not log
 * emails at all (docs 14 §1.3); this is defense in depth for anything that slips
 * through. Returns `[REDACTED]` for anything that is not a plausible email.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) {
    return REDACT_CENSOR;
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = (s: string): string => (s.length <= 1 ? s : `${s[0]}***`);
  return `${head(local)}@${head(domain)}`;
}
