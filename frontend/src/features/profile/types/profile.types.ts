import type { PieceStatus } from '@qalam/shared';

/**
 * Profile-view-local types. Shared wire types (ProfileResponse, UserSummary, FollowRequest, …)
 * live app-level in `@/types/profile`; this file holds only what the profile *view* adds.
 *
 * Collections is intentionally NOT a tab: `v1` has no public collection read (owner-scoped only,
 * docs/11 §10.4), so surfacing it would 404 for every visitor. Tabs are `pieces` + `about`.
 */
export type ProfileTab = 'pieces' | 'about';

/**
 * A row in the profile "Pieces" list. Mirrors the frozen `PieceListItemDto`
 * (`GET /me/pieces`) — the ONLY writer-pieces endpoint in `v1` is viewer-scoped, so this list is
 * available for the OWN profile only. Another writer's piece list has no endpoint (documented
 * gap); their published *count* still shows from `profile.counts.piecesPublished`.
 */
export interface ProfilePiece {
  id: string;
  title: string;
  slug: string | null;
  status: PieceStatus;
  coverImageKey: string | null;
  wordCount: number;
  readingTimeSeconds: number;
  publishedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string;
}
