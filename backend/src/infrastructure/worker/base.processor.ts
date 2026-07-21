import { Logger } from '@nestjs/common';
import { WorkerHost } from '@nestjs/bullmq';
import { UnrecoverableError } from 'bullmq';
import type { Job } from 'bullmq';

import { getPerformanceObserver } from '../../common/performance/performance-observer.port';
import type { JobContext, JobRunner } from '../../common/queue/job-handler';
import type { QueueName } from '../../common/queue/queue.constants';

/**
 * Shared base for every queue's worker. One WorkerHost is bound to a queue
 * (BullMQ's model); it dispatches each job to the typed {@link JobRunner}
 * registered for that job name — so "one worker per queue, one handler per job"
 * without splitting the queue topology.
 *
 * It owns the cross-cutting concerns so handlers don't repeat them:
 * - the `job.*` logging taxonomy (docs 14 §1.3): `job.started` (debug) →
 *   `job.completed` / `job.failed` (warn, retry pending) → `job.dead_lettered`
 *   (error, retries exhausted or unrecoverable → Sentry);
 * - a `{ requestId, jobId, queue }` correlation context (docs 14 §1.5);
 * - stripping the transport `meta` envelope before the handler validates the
 *   business payload.
 *
 * Throwing propagates to BullMQ so its retry/backoff applies; an
 * `UnrecoverableError` (bad payload / no handler) skips remaining retries.
 */
export abstract class BaseProcessor extends WorkerHost {
  protected readonly logger = new Logger(this.constructor.name);
  protected abstract readonly queueName: QueueName;
  private readonly runners: Map<string, JobRunner>;

  constructor(runners: JobRunner[]) {
    super();
    this.runners = new Map(runners.map((r) => [r.job, r]));
  }

  async process(job: Job): Promise<unknown> {
    const requestId = this.requestId(job);
    const runner = this.runners.get(job.name);
    if (runner === undefined) {
      // No handler for this name → permanent; do not retry.
      this.logger.error(
        `job.dead_lettered queue=${this.queueName} job=${job.name} jobId=${job.id ?? '?'}: no registered handler`,
      );
      throw new UnrecoverableError(`no handler for ${this.queueName}/${job.name}`);
    }

    const ctx: JobContext = {
      requestId,
      jobId: String(job.id ?? ''),
      attempt: job.attemptsMade + 1,
    };
    const startedAt = Date.now();
    this.logger.debug(
      `job.started queue=${this.queueName} job=${job.name} jobId=${ctx.jobId} attempt=${ctx.attempt} requestId=${requestId}`,
    );

    try {
      const result = await runner.run(this.payload(job), ctx);
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `job.completed queue=${this.queueName} job=${job.name} jobId=${ctx.jobId} durationMs=${durationMs}`,
      );
      // Queue processing latency/throughput telemetry (P7.3) via the observer.
      getPerformanceObserver()?.observe({
        operation: `queue.${this.queueName}.${job.name}`,
        kind: 'queue',
        durationMs,
        ok: true,
      });
      return result;
    } catch (error) {
      getPerformanceObserver()?.observe({
        operation: `queue.${this.queueName}.${job.name}`,
        kind: 'queue',
        durationMs: Date.now() - startedAt,
        ok: false,
      });
      const err = error instanceof Error ? error : new Error(String(error));
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinal = err instanceof UnrecoverableError || ctx.attempt >= maxAttempts;
      if (isFinal) {
        this.logger.error(
          `job.dead_lettered queue=${this.queueName} job=${job.name} jobId=${ctx.jobId} requestId=${requestId}: ${err.message}`,
          err.stack,
        );
      } else {
        this.logger.warn(
          `job.failed queue=${this.queueName} job=${job.name} jobId=${ctx.jobId} attempt=${ctx.attempt}/${maxAttempts} requestId=${requestId}: ${err.message}`,
        );
      }
      throw err;
    }
  }

  /** The business payload — `job.data` minus the transport `meta` envelope. */
  private payload(job: Job): unknown {
    if (job.data === null || typeof job.data !== 'object') {
      return {};
    }
    const data = { ...(job.data as Record<string, unknown>) };
    delete data.meta;
    return data;
  }

  /** Correlation id carried in the job payload, or a synthetic marker. */
  protected requestId(job: Job): string {
    const meta = (job.data as { meta?: { requestId?: unknown } } | undefined)?.meta;
    return typeof meta?.requestId === 'string' ? meta.requestId : 'no-request-id';
  }
}
