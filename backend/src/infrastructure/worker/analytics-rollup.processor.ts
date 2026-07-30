import { Processor } from '@nestjs/bullmq';

import { QUEUE } from '../../common/queue/queue.constants';
import { BaseProcessor } from './base.processor';
import {
  AnalyticsHourlySnapshotHandler,
  AnalyticsNightlyRollupHandler,
} from './handlers/analytics-rollup.handlers';
import { workerConcurrency } from '../queue/worker-concurrency';

/**
 * Analytics aggregation worker (docs 02 §7) — hourly snapshot + nightly rollup
 * handlers, both reusing `AnalyticsService.generateSnapshots`.
 */
@Processor(QUEUE.AnalyticsRollup, { concurrency: workerConcurrency(QUEUE.AnalyticsRollup) })
export class AnalyticsRollupProcessor extends BaseProcessor {
  protected readonly queueName = QUEUE.AnalyticsRollup;

  constructor(hourly: AnalyticsHourlySnapshotHandler, nightly: AnalyticsNightlyRollupHandler) {
    super([hourly, nightly]);
  }
}
