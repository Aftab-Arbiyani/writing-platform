import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { JOB } from '../../../common/queue/queue.constants';
import { TrendingService } from '../../../modules/feed/trending.service';
import { AbstractJobHandler } from '../abstract-job-handler';

const noPayload = z.object({});

/**
 * Recompute the trending ranking and materialize it into the DB-0 cache (docs 18
 * E6 t4). Reuses `TrendingService.recompute()`; `attempts: 1` (JOB_RETRY) — a
 * failure is retried on the next tick, not now.
 */
@Injectable()
export class TrendingRecomputeHandler extends AbstractJobHandler<typeof JOB.TrendingRecompute> {
  readonly job = JOB.TrendingRecompute;

  constructor(private readonly trending: TrendingService) {
    super();
  }

  validate(raw: unknown): Record<string, never> {
    return noPayload.parse(raw);
  }

  async handle(): Promise<{ recomputed: number }> {
    return { recomputed: await this.trending.recompute() };
  }
}
