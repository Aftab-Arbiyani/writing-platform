import { QUEUE, type QueueName } from '../../common/queue/queue.constants';

/**
 * Per-queue worker concurrency. Read at `@Processor(...)` decorator-evaluation
 * time (before Nest's DI/config is available), so this is a pure `process.env`
 * lookup — `QUEUE_<NAME>_CONCURRENCY` overrides the default. CPU-bound queues
 * (media/sharp) stay low so re-encoding never starves the event loop; I/O-bound
 * fan-out queues (notifications) run wider.
 */
const DEFAULT_CONCURRENCY: Record<QueueName, number> = {
  [QUEUE.ScheduledPublish]: 1, // serialized sweep — avoid double-publishing a due piece
  [QUEUE.Notifications]: 5,
  [QUEUE.MediaProcessing]: 2, // CPU-bound (sharp)
  [QUEUE.AnalyticsRollup]: 1, // heavy aggregate; one at a time
  [QUEUE.TrendingScore]: 1,
  [QUEUE.Emails]: 5,
  [QUEUE.Cache]: 3,
  [QUEUE.Maintenance]: 1,
  [QUEUE.Ai]: 1,
  [QUEUE.Monetization]: 3, // I/O-bound webhook/lifecycle processing
};

/** Resolve a queue's worker concurrency (env override → default). */
export function workerConcurrency(queue: QueueName): number {
  const raw = process.env[`QUEUE_${queue.toUpperCase().replace(/-/g, '_')}_CONCURRENCY`];
  if (raw !== undefined && raw.trim() !== '') {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_CONCURRENCY[queue];
}
