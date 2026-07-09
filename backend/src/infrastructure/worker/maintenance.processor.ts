import { Processor } from '@nestjs/bullmq';

import { QUEUE } from '../../common/queue/queue.constants';
import { BaseProcessor } from './base.processor';
import { DailyCleanupHandler, WeeklyDbMaintenanceHandler } from './handlers/maintenance.handlers';
import { workerConcurrency } from '../queue/worker-concurrency';

/**
 * Maintenance worker — daily cleanup + weekly DB maintenance handlers (docs 04 /
 * 14 §7). Both delegate to `MaintenanceService`.
 */
@Processor(QUEUE.Maintenance, { concurrency: workerConcurrency(QUEUE.Maintenance) })
export class MaintenanceProcessor extends BaseProcessor {
  protected readonly queueName = QUEUE.Maintenance;

  constructor(daily: DailyCleanupHandler, weekly: WeeklyDbMaintenanceHandler) {
    super([daily, weekly]);
  }
}
