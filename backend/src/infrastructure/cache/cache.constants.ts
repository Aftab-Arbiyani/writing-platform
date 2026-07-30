/**
 * Cache key namespaces on Redis DB 0 (ADR §3 — cache DB; flushable without
 * touching queues). Feature modules own their own hot caches (`FeedCacheService`,
 * `AnalyticsCacheService`, `SearchCacheService`, `NotificationsCacheService`);
 * these prefixes let the infrastructure layer *group, inspect, invalidate, and
 * warm* those caches from the admin surface and the cron warmer without
 * reaching into each module.
 *
 * Colon-namespaced to match the existing `feed:*` / `discover:*` / `search:*`
 * key conventions already in the codebase.
 */
export const CACHE_PREFIX = {
  feed: 'feed:',
  discover: 'discover:',
  search: 'search:',
  analytics: 'analytics:',
  profile: 'profile:',
  notifications: 'notif:',
  infra: 'infra:',
} as const;

export type CachePrefix = (typeof CACHE_PREFIX)[keyof typeof CACHE_PREFIX];

/**
 * The warmable cache groups the cron warmer + `POST /admin/cache/warm` refresh.
 * Each names a human-readable group and the key prefix its entries live under
 * (for the admin inspection view). The warm action itself is implemented in
 * {@link CacheWarmerService} by invoking the owning module's read path, which
 * repopulates that module's cache — no cache logic is duplicated here.
 */
export const WARMABLE_CACHES = [
  { key: 'trending', label: 'Trending feed', prefix: CACHE_PREFIX.feed },
  {
    key: 'discovery',
    label: 'Featured writers / pieces / tags / genres',
    prefix: CACHE_PREFIX.discover,
  },
  { key: 'analytics', label: 'Platform analytics dashboard', prefix: CACHE_PREFIX.analytics },
  { key: 'search', label: 'Search suggestions', prefix: CACHE_PREFIX.search },
] as const;

export type WarmableKey = (typeof WARMABLE_CACHES)[number]['key'];

/** Lock-key prefix for the single-flight stampede guard. */
export const CACHE_LOCK_PREFIX = 'infra:lock:';
