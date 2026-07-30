import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { QueueRegistry } from './queue-registry.service';
import type { QueueName } from '../../common/queue/queue.constants';

/**
 * Dead-letter handling. BullMQ has no separate DLQ topic — a job that exhausts
 * its `attempts` stays in the queue's `failed` set (bounded by `removeOnFail`,
 * docs 14 §5). That set IS the dead-letter store: this service inspects it and
 * replays jobs from it. Final-failure detection + the `job.dead_lettered` log
 * live in the base processor's failure handler; the weekly review replays or
 * clears from here (docs 14 §5).
 */
@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);

  constructor(private readonly registry: QueueRegistry) {}

  /** The dead-lettered (failed) jobs for a queue, newest first. */
  async list(queue: QueueName, start = 0, end = 99): Promise<Job[]> {
    return this.registry.get(queue).getFailed(start, end);
  }

  /** Count of dead-lettered jobs for a queue. */
  async count(queue: QueueName): Promise<number> {
    return this.registry.get(queue).getFailedCount();
  }

  /**
   * Re-run a specific failed job (admin "retry" action). Resets the job to
   * `waiting` so a worker picks it up again — used for transient-failure replays
   * once the underlying cause is fixed. Returns false when the id is unknown or
   * the job is not in a failed state.
   */
  async retry(queue: QueueName, jobId: string): Promise<boolean> {
    const q = this.registry.get(queue);
    const job = await q.getJob(jobId);
    if (job === undefined) {
      return false;
    }
    const state = await job.getState();
    if (state !== 'failed') {
      return false;
    }
    await job.retry();
    this.logger.log(`Replayed dead-lettered job ${queue}/${jobId}`);
    return true;
  }

  /** Permanently drop a dead-lettered job (admin "discard"). */
  async discard(queue: QueueName, jobId: string): Promise<boolean> {
    const job = await this.registry.get(queue).getJob(jobId);
    if (job === undefined) {
      return false;
    }
    await job.remove();
    this.logger.log(`Discarded dead-lettered job ${queue}/${jobId}`);
    return true;
  }
}
