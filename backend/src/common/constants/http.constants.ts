/**
 * Cross-cutting HTTP constants (header and cookie names). Kept here rather than
 * inlined so the request-id middleware, exception filter, and future auth code
 * all agree on one spelling.
 */

/** Correlation id header — generated at the edge, echoed on every response (ADR §9). */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Standard rate-limit headers (docs 05 §8). Set by the guard when it lands (Epic 1 t8). */
export const RATE_LIMIT_HEADERS = {
  limit: 'x-ratelimit-limit',
  remaining: 'x-ratelimit-remaining',
  reset: 'x-ratelimit-reset',
} as const;

/**
 * Refresh-token cookie for web clients: httpOnly, Secure, SameSite=Lax,
 * path-scoped to the auth routes (docs 05 §7). The cookie is written by the
 * auth module when refresh issuance lands (Epic 1 t4); this name is fixed now so
 * the path constant and the module stay in sync.
 */
export const REFRESH_TOKEN_COOKIE = 'qalam_rt';
export const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';
