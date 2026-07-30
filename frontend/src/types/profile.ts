import type { FollowStatus, ThemePreference, Visibility } from '@qalam/shared';

/**
 * Shared profile / follow / settings wire types (docs/32 §10) — mirror the frozen `v1` DTOs
 * (`backend/src/modules/users/dto/*`). These live app-level (not in a single feature) because
 * both `features/profile` (view + follow) and `features/settings` (edit) consume them, and a
 * feature must never import another feature (docs/26 §4). Replace with generated
 * `@qalam/api-types` once the backend emits `openapi.json`.
 *
 * Media fields (`avatarKey`, `coverKey`) are S3 KEYS, never URLs — build the URL via
 * `lib/media.ts` `mediaUrl()` (docs/32 §6). Counts that are hardcoded `0` server-side pending
 * later epics are flagged below and must be hidden, never shown as misleading zeros (docs/26 §11).
 */

/** A genre reference (taxonomy) as embedded in a profile. */
export interface Genre {
  id: string;
  slug: string;
  name: string;
}

/**
 * Aggregate profile counts. `followers` / `following` / `piecesPublished` are REAL (denormalized
 * columns); the rest are hardcoded `0` server-side until their epics ship (docs/26 §11 gap #3) —
 * render only the real three, hide the placeholders.
 */
export interface ProfileCounts {
  followers: number;
  following: number;
  piecesPublished: number;
  /** 0 until reading tracking ships (E5) — placeholder, do not display. */
  totalReads: number;
  /** 0 until engagement ships (E7) — placeholder, do not display. */
  totalLikes: number;
  /** 0 until engagement ships (E7) — placeholder, do not display. */
  totalClaps: number;
  /** 0 until engagement ships (E7) — placeholder, do not display. */
  bookmarksReceived: number;
  /** 0 until responses ship (E7) — placeholder, do not display. */
  responseCount: number;
}

/** The viewer's relationship to the profile owner — drives the Follow button state. */
export interface ViewerRelation {
  isSelf: boolean;
  isFollowing: boolean;
  hasPendingRequest: boolean;
}

/**
 * A writer profile. `id` is the owner's user UUID — the target for
 * `POST|DELETE /users/:id/follow` (the three id-types are NOT interchangeable, docs/11 §10.3).
 * When `restricted` is true (a private account viewed by a non-follower stranger), the optional
 * fields below are omitted and only the teaser (avatar/penName/username/counts/isPrivate) shows.
 */
export interface ProfileResponse {
  id: string;
  username: string;
  penName: string;
  avatarKey: string | null;
  isPrivate: boolean;
  counts: ProfileCounts;
  viewerRelation: ViewerRelation;
  restricted: boolean;
  // Present only when not restricted:
  bio?: string | null;
  coverKey?: string | null;
  websiteUrl?: string | null;
  location?: string | null;
  socialLinks?: Record<string, string>;
  defaultLanguageId?: string | null;
  genres?: Genre[];
}

/** `{ key }` returned by avatar/cover upload — build the CDN URL via `mediaUrl()`. */
export interface MediaKey {
  key: string;
}

/** A user row in a followers / following / requests list. `id` = user UUID (follow target). */
export interface UserSummary {
  id: string;
  username: string;
  penName: string | null;
  avatarKey: string | null;
}

/** A pending follow request. `id` is the follow-ROW UUID (target of accept/reject, docs/11 §10.3). */
export interface FollowRequest {
  id: string;
  requester: UserSummary;
  requestedAt: string;
}

/** Result of a follow action: `accepted` (public target) or `pending` (private → request). */
export interface FollowActionResult {
  status: FollowStatus;
}

/** The DB-only preference bag (`GET/PATCH /settings`). Theme is ALSO mirrored to `useThemeStore`. */
export interface SettingsResponse {
  theme: ThemePreference;
  defaultPieceVisibility: Visibility;
  notificationPreferences: Record<string, boolean>;
}

/** `PATCH /me` body — all fields optional (partial update). `username` is permanent (omitted). */
export interface UpdateProfilePayload {
  penName?: string;
  bio?: string;
  websiteUrl?: string;
  location?: string;
  socialLinks?: Record<string, string>;
  isPrivate?: boolean;
  defaultLanguageCode?: string;
  genres?: string[];
}

/** `PATCH /settings` body — all fields optional. */
export interface UpdateSettingsPayload {
  theme?: ThemePreference;
  defaultPieceVisibility?: Visibility;
  notificationPreferences?: Record<string, boolean>;
}
