import type { JobName } from './queue.constants';
import type { JobPayloads } from './job-payloads';

/**
 * Options a producer may attach to an enqueued job. All optional — the queue's
 * default job options (retry/backoff/retention from the infrastructure queue
 * definitions) apply otherwise.
 */
export interface EnqueueOptions {
  /**
   * Deterministic job id for idempotent enqueue (BullMQ de-dupes by id while a
   * job with that id exists). `scheduled-publish` uses `pieceId` so a reschedule
   * replaces the pending job instead of stacking a second one (docs 02 §6.2).
   */
  jobId?: string;
  /** Delay before the job becomes eligible to run (delayed jobs). */
  delayMs?: number;
  /** Lower number = higher priority (BullMQ semantics). */
  priority?: number;
  /** Override the queue's default retry attempts for this job. */
  attempts?: number;
  /**
   * Correlation id propagated from the originating request (`X-Request-Id`) into
   * `job.data.meta.requestId`, so a worker's child logger keeps the same id
   * (docs 14 §1.5). Cron/producer-less jobs mint their own.
   */
  requestId?: string;
}

/**
 * The producer seam. Business modules depend on THIS interface (from `common`),
 * never on the infrastructure module, so the dependency arrow stays one-way.
 * The infrastructure layer provides the implementation under {@link JOB_ENQUEUER}
 * and exports it globally; producers inject it as an optional dependency so unit
 * tests (and any worker-less context) fall back to synchronous behavior when no
 * queue is wired.
 *
 * `enqueue` is generic over the job name: the payload type is checked against
 * {@link JobPayloads} and the target queue is derived from the job (via
 * `JOB_QUEUE`), so a wrong-shaped payload or a job on the wrong queue is a
 * compile error — not a runtime cast in the processor.
 *
 * ```ts
 * constructor(@Optional() @Inject(JOB_ENQUEUER) private readonly jobs?: JobEnqueuer) {}
 * // …
 * await this.jobs?.enqueue(JOB.PublishOne, { pieceId }); // payload type-checked
 * ```
 */
export interface JobEnqueuer {
  enqueue<J extends JobName>(job: J, data: JobPayloads[J], options?: EnqueueOptions): Promise<void>;
}

/** DI token for the {@link JobEnqueuer} implementation (provided by infrastructure). */
export const JOB_ENQUEUER = Symbol('JOB_ENQUEUER');
