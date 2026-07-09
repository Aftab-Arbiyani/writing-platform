import { registerAs } from '@nestjs/config';

import { QUEUE, type QueueName } from '../common/queue/queue.constants';

/**
 * Asynchronous-infrastructure config (Epic 11) — every queue/worker/cron/cache
 * knob, environment-overridable with documented defaults. Read straight from
 * `process.env` inside the factory (resolved lazily after the env file loads),
 * mirroring `trending.config.ts`; the Zod env schema stays non-strict so these
 * pass through. Nothing here is a secret.
 *
 * Governing policy (docs 14 §5): default `attempts: 5`, exponential backoff from
 * 5 s, keep the last 100 completed / 1000 failed jobs per queue (the failed set
 * IS the dead-letter store). `trending-score` recomputes next tick so it does
 * not retry; `emails` retries harder. Concurrency/priority are undocumented —
 * chosen here per queue and overridable.
 */
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw.trim() === '' ? fallback : raw;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  return raw === 'true' || raw === '1';
}

/** Retry/backoff/retention/priority policy for one queue. */
export interface QueuePolicy {
  /** Number of processing attempts before a job is dead-lettered (lands in `failed`). */
  attempts: number;
  /** Exponential backoff base delay in ms (attempt N waits ~ base * 2^(N-1)). */
  backoffMs: number;
  /** Default job priority (lower = higher). */
  priority: number;
  /** Keep the last N completed jobs in Redis. */
  removeOnComplete: number;
  /** Keep the last N failed jobs (the dead-letter window). */
  removeOnFail: number;
}

const SCREAMING = (queue: QueueName): string => queue.toUpperCase().replace(/-/g, '_');

/** Per-queue policy from `QUEUE_<NAME>_ATTEMPTS` / `_BACKOFF_MS` / `_PRIORITY`. */
function policy(
  queue: QueueName,
  defaults: { attempts: number; backoffMs: number; priority: number },
): QueuePolicy {
  const prefix = `QUEUE_${SCREAMING(queue)}`;
  return {
    attempts: num(`${prefix}_ATTEMPTS`, defaults.attempts),
    backoffMs: num(`${prefix}_BACKOFF_MS`, defaults.backoffMs),
    priority: num(`${prefix}_PRIORITY`, defaults.priority),
    removeOnComplete: num(`${prefix}_KEEP_COMPLETED`, 100),
    removeOnFail: num(`${prefix}_KEEP_FAILED`, 1000),
  };
}

export const infrastructureConfig = registerAs('infrastructure', () => ({
  /** Master switch — start the in-process workers (docs 02 §3: extractable later). */
  workersEnabled: bool('WORKERS_ENABLED', true),
  /** Register the repeatable cron schedulers on boot (disable in unit/CI runs). */
  schedulerEnabled: bool('SCHEDULER_ENABLED', true),

  /** Retry/backoff/priority/retention policy, per queue. */
  policies: {
    [QUEUE.ScheduledPublish]: policy(QUEUE.ScheduledPublish, {
      attempts: 5,
      backoffMs: 5_000,
      priority: 1, // user-visible promise — highest priority
    }),
    [QUEUE.Notifications]: policy(QUEUE.Notifications, {
      attempts: 5,
      backoffMs: 5_000,
      priority: 3,
    }),
    [QUEUE.MediaProcessing]: policy(QUEUE.MediaProcessing, {
      attempts: 3,
      backoffMs: 5_000,
      priority: 5,
    }),
    [QUEUE.AnalyticsRollup]: policy(QUEUE.AnalyticsRollup, {
      attempts: 3,
      backoffMs: 10_000,
      priority: 6,
    }),
    [QUEUE.TrendingScore]: policy(QUEUE.TrendingScore, {
      attempts: 1, // recompute-on-next-tick — no point retrying (docs 14 §5)
      backoffMs: 5_000,
      priority: 4,
    }),
    [QUEUE.Emails]: policy(QUEUE.Emails, {
      attempts: 8, // "retries harder" (docs 14 §5)
      backoffMs: 5_000,
      priority: 2,
    }),
    [QUEUE.Cache]: policy(QUEUE.Cache, { attempts: 3, backoffMs: 5_000, priority: 7 }),
    [QUEUE.Maintenance]: policy(QUEUE.Maintenance, {
      attempts: 3,
      backoffMs: 30_000,
      priority: 8,
    }),
    [QUEUE.Ai]: policy(QUEUE.Ai, { attempts: 3, backoffMs: 5_000, priority: 9 }),
  } satisfies Record<QueueName, QueuePolicy>,

  /** Cron patterns (standard 5-field). All overridable per docs 18 (configurable). */
  cron: {
    /** Every minute — publish due scheduled pieces (docs 18 E4 acceptance: within 60 s). */
    scheduledPublish: str('CRON_SCHEDULED_PUBLISH', '* * * * *'),
    /** Hourly — refresh the trending ranking. */
    trendingRecompute: str('CRON_TRENDING_RECOMPUTE', '0 * * * *'),
    /** Hourly — analytics snapshot pass. */
    analyticsHourlySnapshot: str('CRON_ANALYTICS_SNAPSHOT', '0 * * * *'),
    /** Nightly 03:00 — analytics rollup + growth snapshots. */
    analyticsNightlyRollup: str('CRON_ANALYTICS_ROLLUP', '0 3 * * *'),
    /** Daily 04:00 — expired tokens, old notifications, soft-deleted rows. */
    dailyCleanup: str('CRON_DAILY_CLEANUP', '0 4 * * *'),
    /** Weekly Sun 05:00 — database maintenance (ANALYZE + retention). */
    weeklyDbMaintenance: str('CRON_WEEKLY_DB_MAINTENANCE', '0 5 * * 0'),
    /** Weekly Sun 05:30 — cache optimization pass. */
    cacheOptimize: str('CRON_CACHE_OPTIMIZE', '30 5 * * 0'),
    /** Every 15 min — proactively warm hot caches (prevents cold-start stampede). */
    cacheWarm: str('CRON_CACHE_WARM', '*/15 * * * *'),
  },

  /** Cache TTLs (seconds) for the warm/refresh jobs. */
  cacheTtl: {
    trending: num('CACHE_TTL_TRENDING', 300),
    featured: num('CACHE_TTL_FEATURED', 900),
    analyticsDashboard: num('CACHE_TTL_ANALYTICS', 300),
    searchSuggestions: num('CACHE_TTL_SEARCH', 300),
    popularTags: num('CACHE_TTL_POPULAR_TAGS', 900),
    writerProfile: num('CACHE_TTL_WRITER_PROFILE', 600),
    /** Single-flight lock TTL — bounds how long one computer holds the stampede lock. */
    stampedeLock: num('CACHE_STAMPEDE_LOCK_TTL', 10),
  },

  /** Retention windows for the maintenance/cleanup jobs (docs 04 / 14 §7). */
  retention: {
    /** Delete verification/reset tokens this many days past expiry (defense in depth). */
    expiredTokenDays: num('RETENTION_EXPIRED_TOKEN_DAYS', 1),
    /** Prune read/handled notifications older than this (docs 04 §3.7 — 12 months). */
    notificationDays: num('RETENTION_NOTIFICATION_DAYS', 365),
    /** Hard-purge soft-deleted rows whose tombstone is older than this. */
    softDeleteDays: num('RETENTION_SOFT_DELETE_DAYS', 30),
  },
}));
