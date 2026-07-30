import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';

import { QueueRegistry } from './queue-registry.service';

/**
 * Readiness probe for the BullMQ layer: confirm every queue's Redis client can
 * be reached (`client.ping()`), mirroring {@link RedisHealthIndicator}. Reports
 * per-queue depth in the health payload so `/health/ready` doubles as a quick
 * queue snapshot for orchestrators (docs 14 §3).
 */
@Injectable()
export class QueueHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly registry: QueueRegistry,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      // getWaitingCount is a real Redis round-trip: it doubles as a connectivity
      // check (throws if the queue's Redis is unreachable) and a depth readout.
      const depths: Record<string, number> = {};
      for (const { name, queue } of this.registry.all()) {
        depths[name] = await queue.getWaitingCount();
      }
      return indicator.up({ depths });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'queue connectivity check failed';
      return indicator.down({ message });
    }
  }
}
