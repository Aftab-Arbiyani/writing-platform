import type { AnalyticsPeriod, PieceStatus, TrendType } from '@qalam/shared';

import { get, getPage, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';

import type {
  Dashboard,
  GrowthSeries,
  PieceAnalytics,
  PieceListItem,
  PieceMeta,
  Trending,
} from '../types/analytics.types';

/**
 * The analytics `api/` layer — the only place the E10 endpoints are named (docs/32 §10). All
 * self-scoped reads (the JWT identifies the writer); `/analytics/dashboard` returns the combined
 * writer + reader aggregates in ONE call (it supersedes `/analytics/me` + `/analytics/readers/me`).
 * There is NO `/analytics/export` in `v1` — export is built client-side from these payloads
 * (`lib/export-analytics`). Query strings are built here; every read threads an `AbortSignal`.
 */

export const analyticsApi = {
  /** GET /analytics/dashboard — the writer + reader aggregates (all-time). */
  dashboard: (signal?: AbortSignal): Promise<Dashboard> =>
    get<Dashboard>('/analytics/dashboard', { signal }),

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
