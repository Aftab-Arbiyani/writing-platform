/**
 * Handwritten wire types.
 *
 * The envelope shapes are DOMAIN vocabulary and live in @qalam/shared
 * (ADR §5); they are re-exported here so API consumers can import everything
 * wire-related from a single package.
 */
export type { ApiFailure, ApiResponse, ApiSuccess, CursorMeta, OffsetMeta } from '@qalam/shared';

/**
 * PLACEHOLDER — replaced by the generated OpenAPI types once the auth module
 * ships (Phase 1). Web clients receive the refresh token as an httpOnly
 * cookie (ADR §3), so only the access token crosses the JSON boundary here;
 * the mobile variant (refresh token in body) will come from the generated
 * spec.
 */
export interface AuthTokens {
  accessToken: string;
}
