import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { JOB } from '../../../common/queue/queue.constants';
import { MaintenanceService } from '../../maintenance/maintenance.service';
import { AbstractJobHandler } from '../abstract-job-handler';

const noPayload = z.object({});

/** Daily: expired tokens, old notifications, aged soft-deletes. */
@Injectable()
export class DailyCleanupHandler extends AbstractJobHandler<typeof JOB.DailyCleanup> {
  readonly job = JOB.DailyCleanup;

  constructor(private readonly maintenance: MaintenanceService) {
    super();
  }

  validate(raw: unknown): Record<string, never> {
    return noPayload.parse(raw);
  }

  handle(): Promise<unknown> {
    return this.maintenance.dailyCleanup();
  }
}

/** Weekly: ANALYZE + VACUUM recommendations (attempts: 1 — next weekly run retries). */
@Injectable()
export class WeeklyDbMaintenanceHandler extends AbstractJobHandler<typeof JOB.WeeklyDbMaintenance> {
  readonly job = JOB.WeeklyDbMaintenance;

  constructor(private readonly maintenance: MaintenanceService) {
    super();
  }

  validate(raw: unknown): Record<string, never> {
    return noPayload.parse(raw);
  }

  handle(): Promise<unknown> {
    return this.maintenance.weeklyDbMaintenance();
  }
}
