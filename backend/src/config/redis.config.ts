/**
 * Redis config namespace — one instance, logical DB separation (ADR §3):
 * 0 cache · 1 queues · 2 rate-limit · 3 auth (refresh rotation / denylist).
 * Consumers inject ConfigType<typeof redisConfig> and pick the DB for their
 * purpose instead of hardcoding numbers.
 */
import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  cacheDb: 0,
  queuesDb: 1,
  rateLimitDb: 2,
  authDb: 3,
}));
