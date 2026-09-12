/**
 * Reflector metadata keys for route-level decorators. Symbol-like string keys
 * kept in one place so decorators and the guards that read them can never drift.
 */

/** Set by `@Public()`; read by `JwtAuthGuard` to skip authentication. */
export const IS_PUBLIC_KEY = 'umberleaf:isPublic';

/** Set by `@Roles(...)`; read by `RolesGuard` (minimum role, docs 13 §4.3). Legacy — PBAC prefers @Permissions. */
export const ROLES_KEY = 'umberleaf:roles';

/** Set by `@Permissions(...)`; read by `PermissionGuard` (PBAC, docs 13 §4). */
export const PERMISSIONS_KEY = 'umberleaf:permissions';

/** Set by `@RateLimit(...tiers)`; read by `RateLimitGuard`. */
export const RATE_LIMIT_KEY = 'umberleaf:rateLimit';
