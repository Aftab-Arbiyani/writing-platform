import type { TextDirection, Visibility } from '@qalam/shared';

/**
 * Feed wire types (docs/32 §10) — mirror the frozen `v1` DTOs
 * (`backend/src/modules/feed/dto/*`). Replace with generated `@qalam/api-types` once the
 * backend emits `openapi.json`. A feed card carries ONLY what a card renders (docs/05 §11.4);
 * full content is fetched via the reading view. Note: there is **no** per-viewer bookmark flag
 * on a feed item, so a "saved" indicator cannot be shown from feed data alone.
 */

export interface FeedAuthor {
  username: string;
  penName: string | null;
  /** S3 key; build the URL via `mediaUrl()`. */
  avatarKey: string | null;
}

export interface FeedLanguage {
  code: string;
  direction: TextDirection;
  nativeName: string;
}

export interface FeedGenre {
  slug: string;
  name: string;
}

export interface FeedStats {
  likes: number;
  claps: number;
  comments: number;
  responses: number;
}

export interface FeedItem {
  id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  featuredQuote: string | null;
  coverImageKey: string | null;
  language: FeedLanguage;
  genre: FeedGenre | null;
  author: FeedAuthor;
  stats: FeedStats;
  visibility: Visibility;
  wordCount: number;
  readingTimeSeconds: number;
  publishedAt: string | null;
}

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
