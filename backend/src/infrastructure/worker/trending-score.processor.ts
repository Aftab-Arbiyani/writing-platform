import { Processor } from '@nestjs/bullmq';

import { QUEUE } from '../../common/queue/queue.constants';
import { BaseProcessor } from './base.processor';
import { TrendingRecomputeHandler } from './handlers/trending-score.handlers';
import { workerConcurrency } from '../queue/worker-concurrency';

/**
 * Trending recompute worker (docs 02 §6.3) — recomputes + materializes the
 * ranking ({@link TrendingRecomputeHandler}).
 */
@Processor(QUEUE.TrendingScore, { concurrency: workerConcurrency(QUEUE.TrendingScore) })
export class TrendingScoreProcessor extends BaseProcessor {
  protected readonly queueName = QUEUE.TrendingScore;

  constructor(recompute: TrendingRecomputeHandler) {
    super([recompute]);
  }
}
