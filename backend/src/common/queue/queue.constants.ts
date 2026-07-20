/**
 * Queue + job name catalogue — the shared vocabulary between producers (business
 * modules) and consumers (the infrastructure workers). Lives in `common` (not in
 * the infrastructure module) so a business module can enqueue a job through the
 * {@link JobEnqueuer} port without importing infrastructure — keeping the
 * dependency arrow one-way (infrastructure → business, never the reverse).
 *
 * The six canonical queues (`scheduled-publish`, `notifications`,
 * `media-processing`, `analytics-rollup`, `trending-score`, `emails`) are the
 * ADR §3 / docs 02 §7 catalogue. `cache`, `maintenance`, and `ai` are the
 * Epic-11 additions (recorded in docs/00 — cache warming/optimization,
 * system-maintenance sweeps, and a Phase-2 AI placeholder that carries no worker
 * yet). Redis DB 1 holds all of them (ADR §3 Redis map).
 */
export const QUEUE = {
  /** Publishing worker: publish scheduled pieces whose time has arrived. */
  ScheduledPublish: 'scheduled-publish',
  /** In-app notification fan-out (unbounded broadcast recipients). */
  Notifications: 'notifications',
  /** sharp re-encode / thumbnail / metadata extraction. */
  MediaProcessing: 'media-processing',
  /** Analytics snapshots + nightly rollup. */
  AnalyticsRollup: 'analytics-rollup',
  /** Trending recompute + materialization into the Redis cache. */
  TrendingScore: 'trending-score',
  /** Transactional auth mail (registered for parity; no worker in Phase 1). */
  Emails: 'emails',
  /** Cache warming / refresh / weekly optimization. */
  Cache: 'cache',
  /** System maintenance: token/notification/soft-delete cleanup, DB ANALYZE. */
  Maintenance: 'maintenance',
  /** Phase-2 AI placeholder — registered for monitoring; intentionally no worker. */
  Ai: 'ai',
  /** Monetization (AF5): async webhook processing + subscription lifecycle sweeps. */
  Monetization: 'monetization',
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

/** Every queue name as a runtime array (registry iteration, monitoring). */
export const QUEUE_NAMES: readonly QueueName[] = Object.values(QUEUE);

/**
 * Job names, grouped by queue. A queue may carry several job types (e.g. the
 * maintenance queue runs both the daily cleanup and the weekly DB sweep); the
 * processor switches on `job.name`.
 */
export const JOB = {
  /** scheduled-publish: reconciliation sweep of all due scheduled pieces. */
  PublishDue: 'publish-due',
  /** scheduled-publish: a single delayed job targeting one piece at its publishAt. */
  PublishOne: 'publish-one',

  /** notifications: fan a system notification out to every eligible recipient. */
  Broadcast: 'broadcast',

  /** media-processing: generate thumbnail + optimize + extract metadata for a key. */
  MediaOptimize: 'media-optimize',

  /** analytics-rollup: hourly snapshot pass. */
  AnalyticsHourlySnapshot: 'analytics-hourly-snapshot',
  /** analytics-rollup: nightly rollup + growth snapshots. */
  AnalyticsNightlyRollup: 'analytics-nightly-rollup',

  /** trending-score: recompute the trending ranking and materialize it in cache. */
  TrendingRecompute: 'trending-recompute',

  /** cache: warm all hot caches. */
  CacheWarm: 'cache-warm',
  /** cache: refresh a single named cache entry. */
  CacheRefresh: 'cache-refresh',
  /** cache: invalidate one or more cache keys (event-driven). */
  CacheInvalidate: 'cache-invalidate',
  /** cache: weekly cache optimization pass. */
  CacheOptimize: 'cache-optimize',

  /** maintenance: daily cleanup (expired tokens, old notifications, soft-deleted rows). */
  DailyCleanup: 'daily-cleanup',
  /** maintenance: weekly database maintenance (ANALYZE + retention). */
  WeeklyDbMaintenance: 'weekly-db-maintenance',

  /** monetization: process one received provider webhook event (async, idempotent). */
  MonetizationWebhook: 'monetization-webhook',
  /** monetization: sweep subscriptions for trial-ending / grace-expiry / renewal-due. */
  MonetizationLifecycleSweep: 'monetization-lifecycle-sweep',
} as const;

export type JobName = (typeof JOB)[keyof typeof JOB];
