import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { v7 as uuidv7 } from 'uuid';
import type { JobsOptions } from 'bullmq';

import { infrastructureConfig } from '../../config/infrastructure.config';
import type { EnqueueOptions, JobEnqueuer } from '../../common/queue/job-enqueuer.port';
import { JOB_QUEUE, JOB_RETRY, type JobPayloads } from '../../common/queue/job-payloads';
import type { JobName } from '../../common/queue/queue.constants';
import { QueueRegistry } from './queue-registry.service';

/**
 * The one place jobs are added to queues — the {@link JobEnqueuer} implementation
 * bound to the `JOB_ENQUEUER` token. Merges the queue's default policy
 * (attempts/backoff/retention/priority from {@link infrastructureConfig}) with
 * any per-job overrides, and always stamps `data.meta.requestId` so a worker's
 * child logger keeps the originating request's correlation id (docs 14 §1.5).
 * Producer-less callers (cron, event bridge) pass their own minted id.
 */
@Injectable()
export class QueueProducer implements JobEnqueuer {
  private readonly logger = new Logger(QueueProducer.name);

  constructor(
    private readonly registry: QueueRegistry,
    @Inject(infrastructureConfig.KEY)
    private readonly config: ConfigType<typeof infrastructureConfig>,
  ) {}

  async enqueue<J extends JobName>(
    job: J,
    data: JobPayloads[J],
    options: EnqueueOptions = {},
  ): Promise<void> {
    const queue = JOB_QUEUE[job];
    const requestId = options.requestId ?? uuidv7();
    const jobOptions = this.buildJobOptions(job, options);
    const payload = { ...data, meta: { requestId, enqueuedFor: job } };

    await this.registry.get(queue).add(job, payload, jobOptions);
    this.logger.debug(`enqueued ${queue}/${job} (jobId=${jobOptions.jobId ?? 'auto'})`);
  }

  /**
   * Builds BullMQ `JobsOptions`, layering: queue policy (base) → per-job override
   * ({@link JOB_RETRY}) → per-call options (highest). The queue is derived from
   * the job name, so retry/backoff/priority are correct for the job even when it
   * shares a queue with jobs that have different policies.
   */
  buildJobOptions(job: JobName, options: EnqueueOptions): JobsOptions {
    const policy = this.config.policies[JOB_QUEUE[job]];
    const override = JOB_RETRY[job] ?? {};
    return {
      attempts: options.attempts ?? override.attempts ?? policy.attempts,
      backoff: { type: 'exponential', delay: override.backoffMs ?? policy.backoffMs },
      priority: options.priority ?? override.priority ?? policy.priority,
      // Keep bounded history; the `failed` set doubles as the dead-letter store.
      removeOnComplete: policy.removeOnComplete,
      removeOnFail: policy.removeOnFail,
      ...(options.jobId !== undefined ? { jobId: options.jobId } : {}),
      ...(options.delayMs !== undefined ? { delay: options.delayMs } : {}),
    };
  }
}
