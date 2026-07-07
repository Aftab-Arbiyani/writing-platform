/**
 * Reflector metadata keys for route-level decorators. Symbol-like string keys
 * kept in one place so decorators and the guards that read them can never drift.
 */

/** Set by `@Public()`; read by `JwtAuthGuard` to skip authentication. */
export const IS_PUBLIC_KEY = 'qalam:isPublic';

/** Set by `@RateLimit(tier)`; read by `RateLimitGuard` (Epic 1 t8). */
export const RATE_LIMIT_KEY = 'qalam:rateLimit';
