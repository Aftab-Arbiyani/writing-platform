import type { Role } from '@qalam/shared';

/**
 * The principal `JwtStrategy` attaches to `request.user`, read via
 * `@CurrentUser()`. Populated from the **access-token claims only** (stateless
 * hot path, docs 13 §3.2) — no DB load per request. Data-aware checks
 * (verification, suspension, ownership) that need the row live in guards/services
 * that load the user explicitly (e.g. `VerifiedUserGuard`).
 */
export interface AuthenticatedUser {
  id: string;
  role: Role;
  sessionVersion: number;
}
