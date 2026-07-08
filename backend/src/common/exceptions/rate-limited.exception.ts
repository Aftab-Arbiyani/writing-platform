import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from './app.exception';

/**
 * 429 for a breached sliding-window rate limit (docs 05 §8, docs 13 §8). The
 * `RateLimitGuard` sets `Retry-After` + `X-RateLimit-*` headers before throwing.
 */
export class RateLimitedException extends AppException {
  constructor() {
    super(
      ERROR_CODES.RATE_LIMITED,
      'Too many requests. Please slow down.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
