import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { JOB } from '../../../common/queue/queue.constants';
import { CacheService } from '../../cache/cache.service';
import { CacheWarmerService } from '../../cache/cache-warmer.service';
import type { WarmableKey } from '../../cache/cache.constants';
import { AbstractJobHandler } from '../abstract-job-handler';

const noPayload = z.object({});
const refreshPayload = z.object({
  target: z.enum(['trending', 'discovery', 'analytics', 'search']),
});
const invalidatePayload = z.object({
  keys: z.array(z.string()).optional(),
  prefix: z.string().optional(),
});

/** Warm every hot cache (repeatable + on-demand). */
@Injectable()
export class CacheWarmHandler extends AbstractJobHandler<typeof JOB.CacheWarm> {
  readonly job = JOB.CacheWarm;

  constructor(private readonly warmer: CacheWarmerService) {
    super();
  }

  validate(raw: unknown): Record<string, never> {
    return noPayload.parse(raw);
  }

  handle(): Promise<unknown> {
    return this.warmer.warmAll();
  }
}

/** Warm a single named cache group. */
@Injectable()
export class CacheRefreshHandler extends AbstractJobHandler<typeof JOB.CacheRefresh> {
  readonly job = JOB.CacheRefresh;

  constructor(private readonly warmer: CacheWarmerService) {
    super();
  }

  validate(raw: unknown): { target: string } {
    return refreshPayload.parse(raw);
  }

  handle(data: { target: string }): Promise<unknown> {
    // Validated against the enum above, so the cast is safe.
    return this.warmer.warm(data.target as WarmableKey);
  }
}

/** Event-driven invalidation of keys or a prefix. */
@Injectable()
export class CacheInvalidateHandler extends AbstractJobHandler<typeof JOB.CacheInvalidate> {
  readonly job = JOB.CacheInvalidate;

  constructor(private readonly cache: CacheService) {
    super();
  }

  validate(raw: unknown): { keys?: string[]; prefix?: string } {
    return invalidatePayload.parse(raw);
  }

  async handle(data: { keys?: string[]; prefix?: string }): Promise<{ removed: number }> {
    if (data.prefix !== undefined && data.prefix !== '') {
      return { removed: await this.cache.delByPrefix(data.prefix) };
    }
    return { removed: await this.cache.del(...(data.keys ?? [])) };
  }
}

/** Weekly cache-size snapshot for tuning. */
@Injectable()
export class CacheOptimizeHandler extends AbstractJobHandler<typeof JOB.CacheOptimize> {
  readonly job = JOB.CacheOptimize;

  constructor(private readonly cache: CacheService) {
    super();
  }

  validate(raw: unknown): Record<string, never> {
    return noPayload.parse(raw);
  }

  handle(): Promise<unknown> {
    return this.cache.stats();
  }
}
