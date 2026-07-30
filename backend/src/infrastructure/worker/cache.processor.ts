import { Processor } from '@nestjs/bullmq';

import { QUEUE } from '../../common/queue/queue.constants';
import { BaseProcessor } from './base.processor';
import {
  CacheInvalidateHandler,
  CacheOptimizeHandler,
  CacheRefreshHandler,
  CacheWarmHandler,
} from './handlers/cache.handlers';
import { workerConcurrency } from '../queue/worker-concurrency';

/**
 * Cache worker — warm / refresh / invalidate / optimize handlers (the automatic
 * refresh + weekly optimization side of the cache strategy).
 */
@Processor(QUEUE.Cache, { concurrency: workerConcurrency(QUEUE.Cache) })
export class CacheProcessor extends BaseProcessor {
  protected readonly queueName = QUEUE.Cache;

  constructor(
    warm: CacheWarmHandler,
    refresh: CacheRefreshHandler,
    invalidate: CacheInvalidateHandler,
    optimize: CacheOptimizeHandler,
  ) {
    super([warm, refresh, invalidate, optimize]);
  }
}
