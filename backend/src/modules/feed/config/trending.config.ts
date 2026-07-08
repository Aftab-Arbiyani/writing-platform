import { registerAs } from '@nestjs/config';

import { DEFAULT_TRENDING_WEIGHTS, type TrendingWeights } from '../scoring/trending-scoring';

/**
 * Trending configuration (E6). Weights + cache knobs are **env-overridable** so
 * the algorithm is tunable without a code change (docs 18 E6 task 3 —
 * "configurable"); each falls back to the documented default. Read straight from
 * `process.env` (the Zod env schema is non-strict, so extra vars pass through).
 */
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const trendingConfig = registerAs('trending', () => {
  const weights: TrendingWeights = {
    claps: num('TRENDING_W_CLAPS', DEFAULT_TRENDING_WEIGHTS.claps),
    comments: num('TRENDING_W_COMMENTS', DEFAULT_TRENDING_WEIGHTS.comments),
    responses: num('TRENDING_W_RESPONSES', DEFAULT_TRENDING_WEIGHTS.responses),
    completion: num('TRENDING_W_COMPLETION', DEFAULT_TRENDING_WEIGHTS.completion),
    gravity: num('TRENDING_GRAVITY', DEFAULT_TRENDING_WEIGHTS.gravity),
    lookbackDays: num('TRENDING_LOOKBACK_DAYS', DEFAULT_TRENDING_WEIGHTS.lookbackDays),
  };
  return {
    weights,
    /** How many ranked pieces to snapshot into Redis per compute (the trending pool). */
    snapshotSize: num('TRENDING_SNAPSHOT_SIZE', 200),
    /** Trending snapshot TTL — the "recompute cycle" without a background worker. */
    cacheTtlSeconds: num('TRENDING_CACHE_TTL', 300),
  };
});
