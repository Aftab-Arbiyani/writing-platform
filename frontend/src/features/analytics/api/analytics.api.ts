import type { AnalyticsPeriod, PieceStatus, TrendType } from '@qalam/shared';

import { get, getPage, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';

import type {
  BoundedCount,
  Dashboard,
  GrowthSeries,
  PieceAnalytics,
  PieceListItem,
  PieceMeta,
  ReaderAnalytics,
  Trending,
} from '../types/analytics.types';

/** One page is the widest the cursor API allows — the ceiling of the bounded bookmarks count. */
const BOOKMARKS_COUNT_PAGE_SIZE = 50;

/**
 * The analytics `api/` layer — the only place the E10 endpoints are named (docs/32 §10). All
 * self-scoped reads (the JWT identifies the caller). There is NO `/analytics/export` in `v1` —
 * export is built client-side from these payloads (`lib/export-analytics`). Query strings are
 * built here; every read threads an `AbortSignal`.
 *
 * TWO aggregate reads, on purpose (W7c):
 *   • `dashboard` — the WRITER surface (`/me/stats`). Returns `{writer, reader}` in one call, and
 *     that combined read is why it is still used there: the writer page needs the writer half.
 *   • `reader` — the READER surface (`/me/reading`). `/analytics/readers/me` is the reader half
 *     ALONE, so a reader who has never published never pays for writer aggregates they have no
 *     page for. Before W7c the reader numbers existed only as a section of the writer dashboard;
 *     splitting the read is what let them have their own route ([48 §2] item 6).
 */

export const analyticsApi = {
  /** GET /analytics/dashboard — the writer + reader aggregates (all-time). */
  dashboard: (signal?: AbortSignal): Promise<Dashboard> =>
    get<Dashboard>('/analytics/dashboard', { signal }),

  /** GET /analytics/readers/me — the reader half alone (the `/me/reading` surface, W7c). */
  reader: (signal?: AbortSignal): Promise<ReaderAnalytics> =>
    get<ReaderAnalytics>('/analytics/readers/me', { signal }),

  /**
   * GET /me/bookmarks?limit=50 → a BOUNDED count (W7c). `v1` has no bookmarks `COUNT(*)` for the
   * viewer, so this counts one page and reports whether more exist — the same derivation mobile
   * uses. This is NOT `ProfileCountsDto.bookmarksReceived`, which `profile.service.ts` hardcodes
   * to `0`; this endpoint returns the viewer's REAL bookmarks. The caller must render `hasMore`
   * as `50+` rather than a bare total.
   */
  bookmarksCount: async (signal?: AbortSignal): Promise<BoundedCount> => {
    const page = await getPage<unknown>(
      `/me/bookmarks${buildQueryString({ limit: BOOKMARKS_COUNT_PAGE_SIZE })}`,
      { signal },
    );
    return { count: page.items.length, hasMore: page.meta.hasMore };
  },

  /** GET /analytics/me/growth — the writer's growth series (from snapshots; may be empty). */
  growth: ({
    period,
    points,
    signal,
  }: {
    period: AnalyticsPeriod;
    points: number;
    signal?: AbortSignal;
  }): Promise<GrowthSeries> =>
    get<GrowthSeries>(`/analytics/me/growth${buildQueryString({ period, points })}`, { signal }),

  /** GET /analytics/pieces/:id — per-piece performance (owner only). */
  piece: (id: string, signal?: AbortSignal): Promise<PieceAnalytics> =>
    get<PieceAnalytics>(`/analytics/pieces/${encodeURIComponent(id)}`, { signal }),

  /** GET /pieces/:id — the piece meta (title + dates) the analytics page pairs with its metrics. */
  pieceMeta: (id: string, signal?: AbortSignal): Promise<PieceMeta> =>
    get<PieceMeta>(`/pieces/${encodeURIComponent(id)}`, { signal }),

  /** GET /me/pieces — the writer's own pieces (metadata only; rows link to full analytics). */
  myPieces: ({
    status,
    cursor,
    limit = 20,
    signal,
  }: {
    status?: PieceStatus;
    cursor?: string;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<CursorPage<PieceListItem>> =>
    getPage<PieceListItem>(`/me/pieces${buildQueryString({ status, cursor, limit })}`, { signal }),

  /** GET /analytics/trending — platform-wide trending (public, cached). */
  trending: ({
    period,
    type,
    limit,
    signal,
  }: {
    period: AnalyticsPeriod;
    type?: TrendType;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<Trending> =>
    get<Trending>(`/analytics/trending${buildQueryString({ period, type, limit })}`, { signal }),
};
