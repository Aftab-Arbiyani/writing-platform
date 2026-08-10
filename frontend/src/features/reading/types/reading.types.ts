import type { PieceStatus, ShareChannel, TextDirection, Visibility } from '@qalam/shared';

export type { ShareChannel };

/**
 * The reading view's wire types (W1, docs/45 §4.1) — `PieceResponseDto` and
 * `PieceEngagementDto` as the reader consumes them. Only what this surface renders is
 * modelled; writer-side fields (scheduledAt, archivedAt, seoMetadata) are deliberately absent.
 */

/** A TipTap document node. The API serves canonical JSON and never HTML (docs 13 §5.2). */
export interface TipTapNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: { type?: string }[];
  text?: string;
}

/** Author summary embedded in a piece — username + pen name only (no avatar on this DTO). */
export interface PieceAuthor {
  username: string;
  penName: string | null;
}

export interface Language {
  id: string;
  code: string;
  nameEn: string;
  nativeName: string;
  direction: TextDirection;
  script: string | null;
}

/** Genre / tag — both are `{ id, slug, name }` on the wire. */
export interface Taxon {
  id: string;
  slug: string;
  name: string;
}

export interface PieceDetail {
  id: string;
  author: PieceAuthor;
  title: string;
  subtitle: string | null;
  slug: string | null;
  content: TipTapNode;
  featuredQuote: string | null;
  coverImageKey: string | null;
  language: Language | null;
  genre: Taxon | null;
  tags: Taxon[];
  status: PieceStatus;
  visibility: Visibility;
  wordCount: number;
  readingTimeSeconds: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A "more like this" card under the article. A trimmed `PieceSummary` — only what the compact
 * card renders. Re-declared rather than imported from `features/search`: a feature never imports
 * another feature (docs/26 §4), so each owns the slice of the wire shape it uses.
 */
export interface RelatedPiece {
  id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  readingTimeSeconds: number;
  author: { username: string; penName: string | null };
  language: { direction: TextDirection } | null;
}

/** `POST /pieces/:id/likes` — `{ liked, totalLikes }`, the authoritative post-write state. */
export interface LikeResult {
  liked: boolean;
  totalLikes: number;
}

/**
 * `POST /pieces/:id/claps` → `ClapResponseDto` (W7b).
 *
 * Two numbers, and the distinction matters: `viewerClaps` is THIS reader's running total (1..50,
 * what the cap applies to) while `totalClaps` is the piece's total across everyone. A batched flush
 * reconciles both — the viewer's because the server clamped it, the piece's because other readers
 * moved it while the page was open.
 */
export interface ClapResult {
  viewerClaps: number;
  totalClaps: number;
}

/** `GET /pieces/:id/engagement` — counts from `piece_stats` plus this viewer's own state. */
export interface PieceEngagement {
  stats: {
    likes: number;
    claps: number;
    bookmarks: number;
    comments: number;
    responses: number;
    shares: number;
  };
  viewer: {
    hasLiked: boolean;
    /** 0..50 — this viewer's own claps, not the total. */
    clapCount: number;
    hasBookmarked: boolean;
  };
}
