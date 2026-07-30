import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';

import { RedisService } from '../../redis/redis.service';

/**
 * Readiness probe for Redis: `PING` the cache client with a short deadline. Used
 * by `/health/ready` so an orchestrator stops routing traffic when Redis is down
 * (docs 14). Liveness (`/health`) deliberately does NOT check dependencies — a
 * dependency blip must not trigger a pod restart.
 */
@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly redisService: RedisService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const pong = await this.redisService.getClient('cache').ping();
      if (pong !== 'PONG') {
        return indicator.down({ message: `unexpected PING reply: ${pong}` });
      }
      return indicator.up();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'redis ping failed';
      return indicator.down({ message });
    }
  }
}
