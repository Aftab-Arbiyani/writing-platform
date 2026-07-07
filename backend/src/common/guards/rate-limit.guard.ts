import { Injectable, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_TIERS } from '@qalam/shared';
import type { RateLimitTierName } from '@qalam/shared';

import { RATE_LIMIT_KEY } from '../constants/metadata.constants';

/**
 * SKELETON (Epic 1 task 8) — not yet enforcing, and deliberately NOT registered
 * as a global guard, so it can never create a false sense of security. It exists
 * so the `@RateLimit()` decorator, tier vocabulary (`@qalam/shared`), and Redis
 * DB 2 wiring (`RedisModule`) are all in place for the real implementation.
 *
 * The real implementation (docs 05 §8) will:
 *   - resolve the key from the tier's `keyBy` (authenticated user id, else IP),
 *   - run a Redis sliding-window counter on DB 2 (`RedisService.getClient('rateLimit')`),
 *   - set `X-RateLimit-*` headers (`RATE_LIMIT_HEADERS`) on every counted request,
 *   - throw `RATE_LIMITED` (429 + `Retry-After`) on breach.
 *
 * Until then `canActivate` reads the declared tier (proving the wiring) and
 * allows the request unchanged.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const tier = this.reflector.getAllAndOverride<RateLimitTierName | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (tier !== undefined) {
      // TODO(aftab): implement the Redis sliding window (docs 05 §8) — Epic 1 t8.
      const { max, windowSeconds } = RATE_LIMIT_TIERS[tier];
      this.logger.debug(`rate-limit tier "${tier}" (${max}/${windowSeconds}s) not yet enforced`);
    }

    return true;
  }
}
