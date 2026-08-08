import type { PieceStatus, TextDirection, Visibility } from '@qalam/shared';

/**
 * Writing wire types (docs/32 §10) — mirror the frozen `v1` piece DTOs
 * (`backend/src/modules/pieces/dto/*`). Replace with generated `@qalam/api-types` once the
 * backend emits `openapi.json`. `content` is a TipTap/ProseMirror JSON document; the server
 * re-validates it against a schema whitelist (docs/13 §5.2), so the editor must only produce
 * whitelisted nodes/marks.
 */

/** A TipTap document, as it crosses the wire (validated server-side). */
export type TipTapDoc = Record<string, unknown>;

export interface PieceAuthor {
  username: string;
  penName: string | null;
}

export interface PieceLanguage {
  id: string;
  code: string;
  nameEn: string;
  nativeName: string;
  direction: TextDirection;
  script: string | null;
}

export interface PieceGenre {
  id: string;
  slug: string;
  name: string;
}

export interface PieceTag {
  id: string;
  slug: string;
  name: string;
}

/** Full piece (reading/preview/editor-hydrate surface). */
export interface Piece {
  id: string;
  author: PieceAuthor;
  title: string;
  subtitle: string | null;
  slug: string | null;
  content: TipTapDoc;
  featuredQuote: string | null;
  coverImageKey: string | null;
  language: PieceLanguage | null;
  genre: PieceGenre | null;
  tags: PieceTag[];
  status: PieceStatus;
  visibility: Visibility;
  wordCount: number;
  readingTimeSeconds: number;
  scheduledAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Lightweight row for the writer dashboard lists. */
export interface PieceListItem {
  id: string;
  title: string;
  slug: string | null;
  status: PieceStatus;
  visibility: Visibility;
  coverImageKey: string | null;
  wordCount: number;
  readingTimeSeconds: number;
  publishedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string;
}

/**
 * The author's plan piece allowance (B4, docs/45 §4.9) — `GET /me/pieces/limit`.
 *
 * `used` counts live (non-deleted) pieces, so deleting one frees a slot. `limit` of 0 means
 * unlimited, matching the `PlanLimits` convention; `remaining` is null in that case rather than a
 * meaningless number. `canCreate` is the server's own verdict, and it is false in the over-limit
 * case a downgrade produces (`used` above `limit`), where `remaining` clamps at 0.
 */
export interface PieceLimit {
  used: number;
  limit: number;
  remaining: number | null;
  unlimited: boolean;
  canCreate: boolean;
}

// ── Request payloads ──────────────────────────────────────────────────────────

export interface CreatePiecePayload {
  /** Required by the API even for drafts — one language per piece (docs/04 §3.2). */
  languageCode: string;
  title?: string;
  subtitle?: string;
  featuredQuote?: string;
  content?: TipTapDoc;
  genreSlug?: string;
  visibility?: Visibility;
  tags?: string[];
}

export type UpdatePiecePayload = Partial<CreatePiecePayload>;

// ── Taxonomy (browse via /search, docs/12 §2.1.1) ───────────────────────────────

export interface TaxonomyGenre {
  slug: string;
  name: string;
}

export interface TaxonomyLanguage {
  code: string;
  nativeName: string;
  direction: TextDirection;
}
