import { AnalyticsPeriod } from '@qalam/shared';

/** Redis (DB 0) cache keys for the expensive computed reads. */
export const ANALYTICS_CACHE_KEYS = {
  platform: 'analytics:platform:v1',
  trending: (type: string, period: string, limit: number): string =>
    `analytics:trending:v1:${type}:${period}:${limit}`,
  /** Per-viewer per-piece view cooldown (dedup) — TTL = VIEW_DEDUP_COOLDOWN_SECONDS. */
  viewCooldown: (pieceId: string, viewerKey: string): string =>
    `analytics:vcd:v1:${pieceId}:${viewerKey}`,
  /** Admin platform-analytics sections (E12.9), keyed by section + resolved filters. */
  admin: (section: string, filterKey: string): string =>
    `analytics:admin:${section}:v1:${filterKey}`,
} as const;

/** TTLs (seconds). Platform + trending are expensive; short TTL = recompute cadence. */
export const ANALYTICS_CACHE_TTL = {
  platform: 300,
  trending: 300,
  /** Admin analytics sections — moderately expensive multi-table aggregates. */
  admin: 300,
  /** System metrics change fast (queues/cache) — short TTL. */
  adminSystem: 60,
} as const;

/** Trend/snapshot window length in days per period. */
export const PERIOD_WINDOW_DAYS: Record<AnalyticsPeriod, number> = {
  [AnalyticsPeriod.Daily]: 1,
  [AnalyticsPeriod.Weekly]: 7,
  [AnalyticsPeriod.Monthly]: 30,
};

/** Default size for top-N lists (trending, top languages/genres/tags/writers). */
export const TOP_LIST_LIMIT = 10;

/** Active-user windows for DAU / WAU / MAU. */
export const DAU_WINDOW_DAYS = 1;
export const WAU_WINDOW_DAYS = 7;
export const MAU_WINDOW_DAYS = 30;

/** Admin trend-range presets (E12.9). `custom` uses the query's from/to. */
export const ADMIN_TREND_RANGES = [
  'today',
  'yesterday',
  '7d',
  '30d',
  '90d',
  'year',
  'custom',
] as const;

export type AdminTrendRange = (typeof ADMIN_TREND_RANGES)[number];
