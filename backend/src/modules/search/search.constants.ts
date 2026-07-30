/**
 * Module-internal knobs for search (E8). Product-facing bounds (min/max query
 * length, autocomplete cap, recent-search cap) live in `@qalam/shared` limits;
 * these are implementation tuning that no client needs to know.
 */

/** Stable Redis (DB 0) cache keys — versioned so a shape change is a new key. */
export const SEARCH_CACHE_KEYS = {
  /** Trending snapshot (all groups) for a given per-group size. */
  trending: (limit: number): string => `search:trending:v1:${limit}`,
  /** Autocomplete suggestions keyed by scope + cap + normalized query. */
  autocomplete: (type: string, limit: number, query: string): string =>
    `search:ac:v1:${type}:${limit}:${query}`,
} as const;

/** Cache TTLs (seconds). Short — the recompute cadence without a background job. */
export const SEARCH_CACHE_TTL = {
  /** Trending is expensive (windowed aggregates) and changes slowly. */
  trending: 300,
  /** Autocomplete is hot and must stay fresh; a minute absorbs keystroke bursts. */
  autocomplete: 60,
} as const;

/**
 * Lookback window for "popular" (tags/genres/writers) in trending — mirrors the
 * feed/discovery convention (recent engagement, not all-time).
 */
export const TRENDING_LOOKBACK_DAYS = 7;

/**
 * Size of the popular-writers pool considered for trending (before the per-group
 * limit trims it). A small over-fetch keeps the list stable as counts shift.
 */
export const TRENDING_WRITER_POOL = 50;
