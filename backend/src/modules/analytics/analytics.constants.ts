import { AnalyticsPeriod } from '@qalam/shared';

/** Redis (DB 0) cache keys for the expensive computed reads. */
export const ANALYTICS_CACHE_KEYS = {
  platform: 'analytics:platform:v1',
  trending: (type: string, period: string, limit: number): string =>
    `analytics:trending:v1:${type}:${period}:${limit}`,
  /** Per-viewer per-piece view cooldown (dedup) — TTL = VIEW_DEDUP_COOLDOWN_SECONDS. */
  viewCooldown: (pieceId: string, viewerKey: string): string =>
    `analytics:vcd:v1:${pieceId}:${viewerKey}`,
} as const;

/** TTLs (seconds). Platform + trending are expensive; short TTL = recompute cadence. */
export const ANALYTICS_CACHE_TTL = {
  platform: 300,
  trending: 300,
} as const;

/** Trend/snapshot window length in days per period. */
export const PERIOD_WINDOW_DAYS: Record<AnalyticsPeriod, number> = {
  [AnalyticsPeriod.Daily]: 1,
  [AnalyticsPeriod.Weekly]: 7,
  [AnalyticsPeriod.Monthly]: 30,
};

/** Default size for top-N lists (trending, top languages/genres/tags/writers). */
export const TOP_LIST_LIMIT = 10;

/** Active-user windows for DAU / MAU. */
export const DAU_WINDOW_DAYS = 1;
export const MAU_WINDOW_DAYS = 30;
