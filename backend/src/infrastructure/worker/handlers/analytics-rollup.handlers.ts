import { Injectable } from '@nestjs/common';
import { AnalyticsPeriod } from '@qalam/shared';
import { z } from 'zod';

import { JOB } from '../../../common/queue/queue.constants';
import { AnalyticsService } from '../../../modules/analytics/analytics.service';
import { AbstractJobHandler } from '../abstract-job-handler';

const noPayload = z.object({});

/** Hourly: keep the current day's snapshot fresh. */
@Injectable()
export class AnalyticsHourlySnapshotHandler extends AbstractJobHandler<
  typeof JOB.AnalyticsHourlySnapshot
> {
  readonly job = JOB.AnalyticsHourlySnapshot;

  constructor(private readonly analytics: AnalyticsService) {
    super();
  }

  validate(raw: unknown): Record<string, never> {
    return noPayload.parse(raw);
  }

  handle(): Promise<unknown> {
    return this.analytics.generateSnapshots(AnalyticsPeriod.Daily);
  }
}

/** Nightly: finalize daily + roll weekly/monthly snapshots. */
@Injectable()
export class AnalyticsNightlyRollupHandler extends AbstractJobHandler<
  typeof JOB.AnalyticsNightlyRollup
> {
  readonly job = JOB.AnalyticsNightlyRollup;

  constructor(private readonly analytics: AnalyticsService) {
    super();
  }

  validate(raw: unknown): Record<string, never> {
    return noPayload.parse(raw);
  }

  async handle(): Promise<unknown> {
    const daily = await this.analytics.generateSnapshots(AnalyticsPeriod.Daily);
    const weekly = await this.analytics.generateSnapshots(AnalyticsPeriod.Weekly);
    const monthly = await this.analytics.generateSnapshots(AnalyticsPeriod.Monthly);
    return { daily, weekly, monthly };
  }
}
