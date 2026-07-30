import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { infrastructureConfig } from '../../config/infrastructure.config';
import { JOB, QUEUE, type JobName, type QueueName } from '../../common/queue/queue.constants';
import { QueueProducer } from '../queue/queue-producer.service';
import { QueueRegistry } from '../queue/queue-registry.service';

/** One repeatable cron registration. */
interface CronDefinition {
  /** Stable scheduler id — upsert is idempotent on it (survives restarts). */
  id: string;
  queue: QueueName;
  job: JobName;
  pattern: string;
}

/**
 * Registers every repeatable (cron) job as a BullMQ **job scheduler**
 * (`upsertJobScheduler`) at application bootstrap. This is the "Scheduler
 * (repeatable)" mechanism the docs prescribe (docs 02 §7) — no `@nestjs/schedule`
 * needed: the schedule lives in Redis, survives restarts, and each queue's
 * worker executes the fired jobs. Upsert is idempotent, so re-registering on
 * every boot is safe.
 *
 * Cadences (all env-overridable via {@link infrastructureConfig}):
 * - every minute → scheduled-publish sweep
 * - hourly       → trending recompute, analytics snapshot
 * - daily        → cleanup (tokens/notifications/soft-deletes) + nightly rollup
 * - weekly       → DB maintenance + cache optimization
 */
@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly registry: QueueRegistry,
    private readonly producer: QueueProducer,
    @Inject(infrastructureConfig.KEY)
    private readonly config: ConfigType<typeof infrastructureConfig>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.schedulerEnabled) {
      this.logger.warn('Scheduler disabled (SCHEDULER_ENABLED=false) — no cron jobs registered');
      return;
    }
    for (const def of this.definitions()) {
      await this.register(def);
    }
  }

  /** The full cron catalogue, resolved from config. */
  definitions(): CronDefinition[] {
    const { cron } = this.config;
    return [
      {
        id: 'sched:scheduled-publish',
        queue: QUEUE.ScheduledPublish,
        job: JOB.PublishDue,
        pattern: cron.scheduledPublish,
      },
      {
        id: 'sched:trending',
        queue: QUEUE.TrendingScore,
        job: JOB.TrendingRecompute,
        pattern: cron.trendingRecompute,
      },
      {
        id: 'sched:analytics-hourly',
        queue: QUEUE.AnalyticsRollup,
        job: JOB.AnalyticsHourlySnapshot,
        pattern: cron.analyticsHourlySnapshot,
      },
      {
        id: 'sched:analytics-nightly',
        queue: QUEUE.AnalyticsRollup,
        job: JOB.AnalyticsNightlyRollup,
        pattern: cron.analyticsNightlyRollup,
      },
      {
        id: 'sched:daily-cleanup',
        queue: QUEUE.Maintenance,
        job: JOB.DailyCleanup,
        pattern: cron.dailyCleanup,
      },
      {
        id: 'sched:weekly-db',
        queue: QUEUE.Maintenance,
        job: JOB.WeeklyDbMaintenance,
        pattern: cron.weeklyDbMaintenance,
      },
      { id: 'sched:cache-warm', queue: QUEUE.Cache, job: JOB.CacheWarm, pattern: cron.cacheWarm },
      {
        id: 'sched:cache-optimize',
        queue: QUEUE.Cache,
        job: JOB.CacheOptimize,
        pattern: cron.cacheOptimize,
      },
    ];
  }

  private async register(def: CronDefinition): Promise<void> {
    try {
      const queue = this.registry.get(def.queue);
      await queue.upsertJobScheduler(
        def.id,
        { pattern: def.pattern },
        {
          name: def.job,
          data: { meta: { requestId: `cron:${def.id}`, enqueuedFor: def.job } },
          opts: this.producer.buildJobOptions(def.job, {}),
        },
      );
      this.logger.log(`cron registered: ${def.id} (${def.pattern}) → ${def.queue}/${def.job}`);
    } catch (error) {
      // A registration failure (e.g. Redis blip) must not crash boot; the worker
      // connection retries independently. Log loudly — cron won't fire until fixed.
      this.logger.error(
        `failed to register cron ${def.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
