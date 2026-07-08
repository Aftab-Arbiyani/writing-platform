/**
 * Reflector metadata keys for route-level decorators. Symbol-like string keys
 * kept in one place so decorators and the guards that read them can never drift.
 */

/** Set by `@Public()`; read by `JwtAuthGuard` to skip authentication. */
export const IS_PUBLIC_KEY = 'qalam:isPublic';

/** Set by `@Roles(...)`; read by `RolesGuard` (minimum role, docs 13 §4.3). */
export const ROLES_KEY = 'qalam:roles';

/** Set by `@RateLimit(...tiers)`; read by `RateLimitGuard`. */
export const RATE_LIMIT_KEY = 'qalam:rateLimit';
