import type { TextDirection, Visibility } from '@qalam/shared';

/**
 * Search & Discovery wire types (E8/E6, docs/32 §10) — mirror the frozen `v1` DTOs
 * (`backend/src/modules/search/dto/*`, `backend/src/modules/feed/dto/*`). Replace with generated
 * `@qalam/api-types` once the backend emits `openapi.json`. Media fields are S3 KEYS, never URLs
 * — build the URL via `lib/media.ts` `mediaUrl()` (docs/32 §6).
 *
 * This feature is self-contained (docs/26 §4): it re-declares the piece/author shapes rather
 * than importing `features/feed`, so it stays deletable with one `rm -rf`.
 */

export interface SearchAuthor {
  username: string;
  penName: string | null;
  /** S3 key; build the URL via `mediaUrl()`. */
  avatarKey: string | null;
}

export interface SearchLanguageRef {
  code: string;
  direction: TextDirection;
  nativeName: string;
}

export interface SearchGenreRef {
  slug: string;
  name: string;
}

export interface SearchStats {
  likes: number;
  claps: number;
  comments: number;
  responses: number;
}

/**
 * A reading card as returned by piece search AND piece discovery. Search adds a relevance
 * `rank`; discovery omits it. Full content is fetched via the reading view — never here.
 */
export interface PieceSummary {
  id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  featuredQuote: string | null;
  coverImageKey: string | null;
  language: SearchLanguageRef;
  genre: SearchGenreRef | null;
  author: SearchAuthor;
  stats: SearchStats;
  visibility: Visibility;
  wordCount: number;
  readingTimeSeconds: number;
  publishedAt: string | null;
}

/** A piece SEARCH result — a reading card plus the FTS relevance `rank` (higher = closer). */
export interface SearchPiece extends PieceSummary {
  rank: number;
}

/**
 * A writer search result. Private accounts appear (so they can be followed) but as a teaser:
 * `bio` is null and `isPrivate` is true — render the lock/teaser (docs 13 §4.2).
 */
export interface SearchWriter {
  userId: string;
  username: string;
  penName: string | null;
  bio: string | null;
  avatarKey: string | null;
  isPrivate: boolean;
  followersCount: number;
  piecesCount: number;
  rank: number;
}

export interface SearchTag {
  slug: string;
  name: string;
  pieceCount: number;
}

export interface SearchGenre {
  slug: string;
  name: string;
  pieceCount: number;
}

export interface SearchLanguage {
  code: string;
  nativeName: string;
  direction: TextDirection;
  pieceCount: number;
}

/** `GET /search` grouped preview — every group present (empty array when no matches). */
export interface GlobalSearchResult {
  writers: SearchWriter[];
  pieces: SearchPiece[];
  tags: SearchTag[];
  genres: SearchGenre[];
  languages: SearchLanguage[];
}

// ── Autocomplete ─────────────────────────────────────────────────────────────────────────

export interface WriterSuggestion {
  username: string;
  penName: string | null;
  avatarKey: string | null;
}

export interface TagSuggestion {
  slug: string;
  name: string;
}

export interface GenreSuggestion {
  slug: string;
  name: string;
}

export interface PieceSuggestion {
  slug: string | null;
  title: string;
}

/** `GET /search/autocomplete` — ≤10 per group; groups the `type` filter excluded come back empty. */
export interface AutocompleteResult {
  writers: WriterSuggestion[];
  tags: TagSuggestion[];
  genres: GenreSuggestion[];
  pieces: PieceSuggestion[];
}

// ── Trending ─────────────────────────────────────────────────────────────────────────────

export interface TrendingKeyword {
  keyword: string;
  searchCount: number;
}

export interface TrendingWriter {
  username: string;
  penName: string | null;
  avatarKey: string | null;
  followersCount: number;
}

/** `GET /search/trending` — what people search + engage with now (cached snapshot). */
export interface TrendingSearches {
  keywords: TrendingKeyword[];
  tags: SearchTag[];
  genres: SearchGenre[];
  writers: TrendingWriter[];
}

// ── Recent (authenticated) ───────────────────────────────────────────────────────────────

/** One stored recent search for the signed-in user (`GET /search/recent`). */
export interface RecentSearch {
  id: string;
  query: string;
  searchType: string;
  searchedAt: string;
}

// ── Discovery (E6, `/discover/*`) ────────────────────────────────────────────────────────

/** A writer in a discovery list — always a public writer (private accounts excluded, docs 13 §4.2). */
export interface WriterCard {
  username: string;
  penName: string | null;
  avatarKey: string | null;
  bio: string | null;
  followersCount: number;
  piecesCount: number;
}

/** Trending taxonomy widgets from `/discover/{tags,genres,languages}` (recent-usage ranked). */
export interface TrendingTag {
  slug: string;
  name: string;
  pieceCount: number;
}

export interface TrendingGenre {
  slug: string;
  name: string;
  pieceCount: number;
}

export interface TrendingLanguage {
  code: string;
  nativeName: string;
  direction: TextDirection;
  pieceCount: number;
}
