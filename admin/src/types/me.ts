/**
 * The subset of the backend `ProfileResponseDto` (`GET /me`) the admin chrome uses for identity.
 * `/me` returns NO `role` (role comes from the JWT claim) and NO `email` (only the login body has
 * it). Hand-declared until `@qalam/api-types` emits generated types (docs/32; api-types is a
 * placeholder today).
 */
export interface MeResponse {
  id: string;
  username: string;
  penName: string;
  avatarKey: string | null;
}
