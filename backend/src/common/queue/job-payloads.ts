import { JOB, QUEUE, type JobName, type QueueName } from './queue.constants';

/**
 * The typed job contract — the compile-time payload shape for every job, keyed
 * by job name (mirrors how {@link DomainEventMap} keys payloads by event name).
 * This is what makes `enqueue(job, data)` type-safe end to end: a producer that
 * passes the wrong fields, and a handler that reads a field the producer never
 * sends, are both compile errors.
 *
 * Payloads use only primitive/literal types so this file stays dependency-free
 * (business types are validated at the worker boundary, not imported here).
 */
export interface JobPayloads {
  [JOB.PublishDue]: Record<string, never>;
  [JOB.PublishOne]: { pieceId: string };

  [JOB.Broadcast]: { recordId: string };

  [JOB.MediaOptimize]: { key: string; kind: 'avatar' | 'cover' };

  [JOB.AnalyticsHourlySnapshot]: Record<string, never>;
  [JOB.AnalyticsNightlyRollup]: Record<string, never>;

  [JOB.TrendingRecompute]: Record<string, never>;

  [JOB.CacheWarm]: Record<string, never>;
  [JOB.CacheRefresh]: { target: string };
  [JOB.CacheInvalidate]: { keys?: string[]; prefix?: string };
  [JOB.CacheOptimize]: Record<string, never>;

  [JOB.DailyCleanup]: Record<string, never>;
  [JOB.WeeklyDbMaintenance]: Record<string, never>;

  [JOB.MonetizationWebhook]: { webhookEventId: string };
  [JOB.MonetizationLifecycleSweep]: Record<string, never>;
}

/**
 * Which queue each job runs on — the compile-time job→queue binding. `enqueue`
 * derives the queue from the job name, so a job can never be added to the wrong
 * queue (the mismatch is caught at the type level via {@link JobName}).
 */
export const JOB_QUEUE: Record<JobName, QueueName> = {
  [JOB.PublishDue]: QUEUE.ScheduledPublish,
  [JOB.PublishOne]: QUEUE.ScheduledPublish,
  [JOB.Broadcast]: QUEUE.Notifications,
  [JOB.MediaOptimize]: QUEUE.MediaProcessing,
  [JOB.AnalyticsHourlySnapshot]: QUEUE.AnalyticsRollup,
  [JOB.AnalyticsNightlyRollup]: QUEUE.AnalyticsRollup,
  [JOB.TrendingRecompute]: QUEUE.TrendingScore,
  [JOB.CacheWarm]: QUEUE.Cache,
  [JOB.CacheRefresh]: QUEUE.Cache,
  [JOB.CacheInvalidate]: QUEUE.Cache,
  [JOB.CacheOptimize]: QUEUE.Cache,
  [JOB.DailyCleanup]: QUEUE.Maintenance,
  [JOB.WeeklyDbMaintenance]: QUEUE.Maintenance,
  [JOB.MonetizationWebhook]: QUEUE.Monetization,
  [JOB.MonetizationLifecycleSweep]: QUEUE.Monetization,
};

/** Per-job retry/priority overrides layered over the queue default (docs 14 §5). */
export interface JobRetryPolicy {
  attempts?: number;
  backoffMs?: number;
  priority?: number;
}

/**
 * Per-job overrides of the per-queue policy — declared here (the contract) so the
 * producer can apply them at enqueue time. Only jobs that differ from their
 * queue default appear; everything else inherits `infrastructureConfig.policies`.
 * Examples: a recompute retries once (next tick fixes it); the weekly DB sweep
 * retries once (the next weekly run is the real retry) even though it shares the
 * maintenance queue with the daily cleanup that keeps the queue default.
 */
export const JOB_RETRY: Partial<Record<JobName, JobRetryPolicy>> = {
  [JOB.TrendingRecompute]: { attempts: 1 },
  [JOB.WeeklyDbMaintenance]: { attempts: 1 },
};
