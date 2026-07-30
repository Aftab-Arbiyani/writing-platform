import { Injectable } from '@nestjs/common';
import type { Job, JobType } from 'bullmq';

import { QUEUE_NAMES, type QueueName } from '../../common/queue/queue.constants';
import { DeadLetterService } from '../queue/dead-letter.service';
import { QueueRegistry } from '../queue/queue-registry.service';

/** Job-count breakdown by state (the depth-by-state metric, docs 14 §4.2). */
export interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

/** Per-queue monitoring snapshot. */
export interface QueueStatus {
  name: QueueName;
  paused: boolean;
  counts: QueueCounts;
  /** Age of the oldest waiting job in ms — the stall detector (docs 14 §4.2). */
  oldestWaitingAgeMs: number;
  /** Number of connected workers processing this queue (worker health). */
  workers: number;
}

/** A single job's monitoring view. */
export interface JobView {
  id: string;
  name: string;
  queue: QueueName;
  state: string;
  attemptsMade: number;
  maxAttempts: number;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  delay: number;
  failedReason: string | null;
  data: unknown;
}

const ALL_STATES: JobType[] = ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'];

/**
 * Read model behind the admin monitoring APIs (docs 14 §4.2/§5). Aggregates
 * queue depth-by-state, the oldest-waiting-age stall signal, worker health, and
 * job inspection — the same numbers Phase 1.5 will export to Prometheus, exposed
 * here as JSON for the admin panel.
 */
@Injectable()
export class QueueMonitorService {
  constructor(
    private readonly registry: QueueRegistry,
    private readonly deadLetter: DeadLetterService,
  ) {}

  /** Snapshot every registered queue. */
  async listQueues(): Promise<QueueStatus[]> {
    return Promise.all(QUEUE_NAMES.map((name) => this.queueStatus(name)));
  }

  /** Snapshot one queue. */
  async queueStatus(name: QueueName): Promise<QueueStatus> {
    const queue = this.registry.get(name);
    const [counts, paused, oldestWaitingAgeMs, workers] = await Promise.all([
      this.counts(name),
      queue.isPaused(),
      this.oldestWaitingAgeMs(name),
      queue.getWorkers().then((w) => w.length),
    ]);
    return { name, paused, counts, oldestWaitingAgeMs, workers };
  }

  /** Job-count breakdown for a queue. */
  async counts(name: QueueName): Promise<QueueCounts> {
    const c = await this.registry
      .get(name)
      .getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
    return {
      waiting: c.waiting ?? 0,
      active: c.active ?? 0,
      completed: c.completed ?? 0,
      failed: c.failed ?? 0,
      delayed: c.delayed ?? 0,
      paused: c.paused ?? 0,
    };
  }

  /** List jobs in a queue filtered by state, paginated. */
  async listJobs(
    name: QueueName,
    state: JobType | 'all',
    offset: number,
    limit: number,
  ): Promise<JobView[]> {
    const types = state === 'all' ? ALL_STATES : [state];
    const jobs = await this.registry.get(name).getJobs(types, offset, offset + limit - 1);
    return Promise.all(
      jobs.filter((j): j is Job => j !== undefined).map((j) => this.toView(name, j)),
    );
  }

  /** Fetch one job by id within a queue. */
  async getJob(name: QueueName, jobId: string): Promise<JobView | null> {
    const job = await this.registry.get(name).getJob(jobId);
    return job === undefined ? null : this.toView(name, job);
  }

  /** Replay a failed job (admin retry action). */
  retryJob(name: QueueName, jobId: string): Promise<boolean> {
    return this.deadLetter.retry(name, jobId);
  }

  private async toView(name: QueueName, job: Job): Promise<JobView> {
    return {
      id: String(job.id ?? ''),
      name: job.name,
      queue: name,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 1,
      timestamp: job.timestamp,
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null,
      delay: job.delay ?? 0,
      failedReason: job.failedReason ?? null,
      data: job.data,
    };
  }

  private async oldestWaitingAgeMs(name: QueueName): Promise<number> {
    const [oldest] = await this.registry.get(name).getWaiting(0, 0);
    if (oldest === undefined) {
      return 0;
    }
    return Math.max(0, Date.now() - oldest.timestamp);
  }
}
