import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_TIERS } from '@qalam/shared';
import type { RateLimitTier, RateLimitTierName } from '@qalam/shared';
import type { Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';

import { RATE_LIMIT_HEADERS } from '../constants/http.constants';
import { RATE_LIMIT_KEY } from '../constants/metadata.constants';
import { RateLimitedException } from '../exceptions/rate-limited.exception';
import { RedisService } from '../../redis/redis.service';

interface TierResult {
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfter: number;
  breached: boolean;
}

/** Marks a request the guard has already processed (global + route dedupe). */
const RATE_LIMIT_APPLIED = Symbol('rateLimitApplied');

/** Fallback tier for any endpoint that does not declare its own (docs 05 §8). */
const DEFAULT_TIER: RateLimitTierName = 'apiDefault';

/**
 * Redis sliding-window rate limiting (docs 05 §8, docs 13 §8) on Redis DB 2.
 * Exact sorted-set algorithm (no fixed-window boundary bursts).
 *
 * Registered **globally** (APP_GUARD, after `JwtAuthGuard` so the authenticated
 * user is available for user-keyed tiers): every endpoint is rate-limited, using
 * its declared `@RateLimit(...)` tier(s) or the `apiDefault` baseline otherwise —
 * so no route can ship unlimited. Idempotent per request (a route that also
 * carries `@UseGuards(RateLimitGuard)` is counted once), skips the
 * liveness/readiness/metrics probe paths (docs 14 §3), and is disabled by
 * `RATE_LIMIT_ENABLED=false` (load tests). Keyed per the tier's `keyBy` (user id
 * when authenticated, else client IP, plus email for auth tiers).
 *
 * Runs before the ValidationPipe, so `request.body` is raw — fine for deriving a
 * key (email is lowercased; missing = IP-only). Sets `X-RateLimit-*` on every
 * counted request and `Retry-After` + 429 `RATE_LIMITED` on breach.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly redis: Redis;

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {
    this.redis = this.redisService.getClient('rateLimit');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.RATE_LIMIT_ENABLED === 'false' || context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Never rate-limit health probes / the metrics scrape target (docs 14 §3).
    const path = request.path ?? request.url ?? '';
    if (path === '/health' || path.startsWith('/health/') || path.startsWith('/metrics')) {
      return true;
    }

    // Idempotent: the global guard runs first and marks the request, so a
    // route-level `@UseGuards(RateLimitGuard)` never double-counts.
    const marker = request as Request & { [RATE_LIMIT_APPLIED]?: boolean };
    if (marker[RATE_LIMIT_APPLIED] === true) {
      return true;
    }
    marker[RATE_LIMIT_APPLIED] = true;

    // Declared tier(s) win; unclassified endpoints fall back to the baseline.
    const declared = this.reflector.getAllAndOverride<RateLimitTierName[] | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    const tiers = declared !== undefined && declared.length > 0 ? declared : [DEFAULT_TIER];

    let tightest: TierResult | null = null;
    let breach: TierResult | null = null;

    for (const name of tiers) {
      const tier = RATE_LIMIT_TIERS[name];
      const result = await this.consume(name, tier, request);
      if (tightest === null || result.remaining < tightest.remaining) {
        tightest = result;
      }
      if (result.breached) {
        breach = result;
      }
    }

    if (tightest !== null) {
      response.setHeader(RATE_LIMIT_HEADERS.limit, tightest.limit);
      response.setHeader(RATE_LIMIT_HEADERS.remaining, Math.max(0, tightest.remaining));
      response.setHeader(RATE_LIMIT_HEADERS.reset, tightest.resetSeconds);
    }
    if (breach !== null) {
      response.setHeader('Retry-After', breach.retryAfter);
      throw new RateLimitedException();
    }
    return true;
  }

  private async consume(
    name: RateLimitTierName,
    tier: RateLimitTier,
    request: Request,
  ): Promise<TierResult> {
    const key = `ratelimit:${name}:${this.resolveScope(tier, request)}`;
    const now = Date.now();
    const windowMs = tier.windowSeconds * 1000;
    const member = `${now}-${randomUUID()}`;

    const results = await this.redis
      .multi()
      .zremrangebyscore(key, 0, now - windowMs)
      .zadd(key, now, member)
      .zcard(key)
      .pexpire(key, windowMs)
      .exec();

    const count = Number(results?.[2]?.[1] ?? 0);
    const breached = count > tier.max;

    let retryAfter = tier.windowSeconds;
    if (breached) {
      const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestScore = Number(oldest[1] ?? now);
      retryAfter = Math.max(1, Math.ceil((oldestScore + windowMs - now) / 1000));
    }

    return {
      limit: tier.max,
      remaining: tier.max - count,
      resetSeconds: Math.ceil((now + windowMs) / 1000),
      retryAfter,
      breached,
    };
  }

  private resolveScope(tier: RateLimitTier, request: Request): string {
    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const userId = (request as Request & { user?: { id?: string } }).user?.id;

    switch (tier.keyBy) {
      case 'ip':
        return `ip:${ip}`;
      case 'user':
        return userId !== undefined ? `user:${userId}` : `ip:${ip}`;
      case 'user-or-ip':
        return userId !== undefined ? `user:${userId}` : `ip:${ip}`;
      case 'ip+email': {
        const body = request.body as { email?: unknown };
        const email = typeof body?.email === 'string' ? body.email.toLowerCase() : 'anon';
        return `ip:${ip}:email:${email}`;
      }
    }
  }
}
