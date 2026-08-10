import type { AnalyticsPeriod, PieceStatus, Visibility } from '@qalam/shared';

/**
 * Writer-analytics wire types (E10, docs/32 §10) — mirror the frozen `v1` DTOs
 * (`backend/src/modules/analytics/dto/*`) plus the two piece reads this feature reuses
 * (`/me/pieces`, `/pieces/:id`). Replace with generated `@qalam/api-types` once the backend emits
 * `openapi.json`. The analytics feature re-declares the piece shapes rather than importing
 * `features/writing` (a feature never imports another feature, docs/26 §4).
 */

/** A ranked entity in a top-N / trending / favorites list. */
export interface RankedItem {
  key: string;
  label: string;
  count: number;
}

/** One growth-over-time point (from a snapshot). Metric keys: views, uniqueViews, reads, completedReads, followersGained, piecesPublished. */
export interface GrowthPoint {
  periodStart: string;
  metrics: Record<string, number>;
}

export interface GrowthSeries {
  period: string;
  points: GrowthPoint[];
}

/** Share-channel breakdown for a piece ("reading / traffic sources"). */
export interface ReadingSources {
  internal: number;
  external: number;
  copyLink: number;
}

/** `GET /analytics/pieces/:id` — per-piece performance (owner only). */
export interface PieceAnalytics {
  pieceId: string;
  views: number;
  uniqueViews: number;
  reads: number;
  /** completed reads ÷ views (0–1). */
  completionRate: number;
  averageReadTimeSeconds: number;
  claps: number;
  comments: number;
  responses: number;
  bookmarks: number;
  shares: number;
  readingSources: ReadingSources;
  publishedAt: string | null;
}

export interface MostPopularPiece {
  pieceId: string;
  title: string;
  slug: string | null;
  views: number;
}

/** `GET /analytics/me` — the writer's own all-time aggregates. */
export interface WriterAnalytics {
  totalViews: number;
  uniqueViews: number;
  reads: number;
  completionRate: number;
  totalReadSeconds: number;
  averageReadTimeSeconds: number;
  followersGained: number;
  piecesPublished: number;
  piecesArchived: number;
  commentsReceived: number;
  clapsReceived: number;
  bookmarksReceived: number;
  responsesReceived: number;
  mostPopularPiece: MostPopularPiece | null;
}

/** `GET /analytics/readers/me` — the user's own reading habits ("Reader Insights"). */
export interface ReaderAnalytics {
  piecesRead: number;
  readingTimeSeconds: number;
  completedReads: number;
  currentStreak: number;
  longestStreak: number;
  favoriteGenres: RankedItem[];
  favoriteLanguages: RankedItem[];
}

/** `GET /analytics/dashboard` — combined writer + reader. */
export interface Dashboard {
  writer: WriterAnalytics;
  reader: ReaderAnalytics;
}

/**
 * A count derived from ONE page of a cursor-paginated list — the shape mobile calls a
 * "bounded count" (`profile_repository_impl._boundedCount`). `v1` exposes no `COUNT(*)` for a
 * viewer's bookmarks, so the only honest figure is "how many are on the first page, and is there
 * more". `hasMore` is what keeps it honest: the reading page renders `50+`, never a bare `50`
 * that reads like a total. See [48 §4] — the same reason `profile-stats.tsx` omits the
 * server-hardcoded `bookmarksReceived`.
 */
export interface BoundedCount {
  count: number;
  hasMore: boolean;
}

/** `GET /analytics/trending` (public) — platform-wide ranked entities. */
export interface Trending {
  period: string;
  pieces: RankedItem[];
  writers: RankedItem[];
  genres: RankedItem[];
  tags: RankedItem[];
}

/** Lightweight row from `GET /me/pieces` — metadata only (no per-piece metrics live here). */
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

/** The subset of `GET /pieces/:id` the piece-analytics page needs (title + dates for "Last updated"). */
export interface PieceMeta {
  id: string;
  title: string;
  slug: string | null;
  status: PieceStatus;
  visibility: Visibility;
  readingTimeSeconds: number;
  wordCount: number;
  publishedAt: string | null;
  updatedAt: string;
}

/** The Zustand-tracked growth window (a "date range" preset expressed as period + point count). */
export interface GrowthWindow {
  period: AnalyticsPeriod;
  points: number;
}
