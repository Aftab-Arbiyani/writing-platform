import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';
import type { RateLimitTierName } from '@qalam/shared';

import { RATE_LIMIT_KEY } from '../constants/metadata.constants';

/**
 * Declares one or more rate-limit tiers for a route (docs 05 §8, docs 13 §8).
 * Tiers are defined in `@qalam/shared` (`RATE_LIMIT_TIERS`); `RateLimitGuard`
 * enforces each with a Redis sliding window (DB 2). Multiple tiers model
 * dual-window limits, e.g. login is 5/min **and** 20/hour:
 *
 * ```ts
 * @RateLimit('authLogin', 'authLoginHourly')
 * @Post('login')
 * login() { … }
 * ```
 */
export function RateLimit(...tiers: RateLimitTierName[]): CustomDecorator<string> {
  return SetMetadata(RATE_LIMIT_KEY, tiers);
}
