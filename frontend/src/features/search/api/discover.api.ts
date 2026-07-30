import type { DiscoverPieceKind, WriterKind } from '@qalam/shared';

import { getPage, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';

import type {
  PieceSummary,
  TrendingGenre,
  TrendingLanguage,
  TrendingTag,
  WriterCard,
} from '../types/search.types';

/**
 * The discovery `api/` layer (E6) — `/discover/*`. The search feature names these itself rather
 * than importing `features/feed` (a feature never imports another feature, docs/26 §4); the two
 * endpoints overlap, which is fine — the api layer is the seam, not shared code. All public.
 */

interface KindArgs<K> {
  kind: K;
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

interface ListArgs {
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

export const discoverApi = {
  /** GET /discover/writers?kind= — featured | popular | new writers. */
  writers: ({
    kind,
    cursor,
    limit = 12,
    signal,
  }: KindArgs<WriterKind>): Promise<CursorPage<WriterCard>> => {
    const query = buildQueryString({ kind, cursor, limit });
    return getPage<WriterCard>(`/discover/writers${query}`, { signal });
  },

  /** GET /discover/pieces?kind= — featured | recent | most_clapped | most_discussed pieces. */
  pieces: ({
    kind,
    cursor,
    limit = 12,
    signal,
  }: KindArgs<DiscoverPieceKind>): Promise<CursorPage<PieceSummary>> => {
    const query = buildQueryString({ kind, cursor, limit });
    return getPage<PieceSummary>(`/discover/pieces${query}`, { signal });
  },

  /** GET /feed/trending — the Redis-cached trending-pieces snapshot (a genuine "Trending" row). */
  trendingPieces: ({ cursor, limit = 12, signal }: ListArgs = {}): Promise<
    CursorPage<PieceSummary>
  > => {
    const query = buildQueryString({ cursor, limit });
    return getPage<PieceSummary>(`/feed/trending${query}`, { signal });
  },

  /** GET /discover/tags — trending tags (cached; recent public usage). */
  tags: ({ cursor, limit, signal }: ListArgs = {}): Promise<CursorPage<TrendingTag>> => {
    const query = buildQueryString({ cursor, limit });
    return getPage<TrendingTag>(`/discover/tags${query}`, { signal });
  },

  /** GET /discover/genres — trending genres (cached; recent public pieces). */
  genres: ({ cursor, limit, signal }: ListArgs = {}): Promise<CursorPage<TrendingGenre>> => {
    const query = buildQueryString({ cursor, limit });
    return getPage<TrendingGenre>(`/discover/genres${query}`, { signal });
  },

  /** GET /discover/languages — trending languages (cached; recent public pieces). */
  languages: ({ cursor, limit, signal }: ListArgs = {}): Promise<CursorPage<TrendingLanguage>> => {
    const query = buildQueryString({ cursor, limit });
    return getPage<TrendingLanguage>(`/discover/languages${query}`, { signal });
  },
};
