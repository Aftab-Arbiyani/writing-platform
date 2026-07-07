import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';
import type { RateLimitTierName } from '@qalam/shared';

import { RATE_LIMIT_KEY } from '../constants/metadata.constants';

/**
 * Declares the rate-limit tier for a route (docs 05 §8). Tiers are defined in
 * `@qalam/shared` (`RATE_LIMIT_TIERS`); the `RateLimitGuard` reads this metadata
 * and enforces the sliding window.
 *
 * ```ts
 * @RateLimit('authLogin')
 * @Post('login')
 * login() { … }
 * ```
 *
 * Enforcement lands in Epic 1 task 8 — see `RateLimitGuard`.
 */
export function RateLimit(tier: RateLimitTierName): CustomDecorator<string> {
  return SetMetadata(RATE_LIMIT_KEY, tier);
}
