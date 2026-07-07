/**
 * The authenticated principal attached to `request.user` by `JwtStrategy`, read
 * via the `@CurrentUser()` decorator. Grows in Phase 1 (roles for RBAC, etc.);
 * kept to the id for the foundation since no user store exists yet.
 */
export interface AuthenticatedUser {
  /** The user's id (from the access token's `sub` claim). */
  id: string;
}
