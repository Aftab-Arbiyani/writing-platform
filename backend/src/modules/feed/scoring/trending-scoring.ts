/**
 * Trending score — the configurable ranking algorithm (docs 18 E6 task 3). Pure
 * functions so the weights are testable in isolation and the SAME formula backs
 * both the SQL ranking query and the unit tests.
 *
 * score = engagement / timeDecay, where
 *   engagement = wClaps·claps + wComments·comments + wResponses·responses
 *              + wCompletion·completionRate      (completionRate = reads/views ∈ [0,1])
 *   timeDecay  = (ageHours + 2) ^ gravity        (Hacker-News-style gravity)
 *
 * Recency and engagement both matter; gravity controls how fast old pieces fall.
 * Weights are injected from {@link trendingConfig} (env-overridable) — nothing
 * here is hard-coded into the query.
 */

/** The tunable knobs of the trending algorithm. */
export interface TrendingWeights {
  claps: number;
  comments: number;
  responses: number;
  /** Weight on reading completion (reads ÷ views); dormant until analytics (E5). */
  completion: number;
  /** Time-decay exponent — higher sinks old pieces faster. */
  gravity: number;
  /** Only pieces published within this many days are candidates. */
  lookbackDays: number;
}

export const DEFAULT_TRENDING_WEIGHTS: TrendingWeights = {
  claps: 3,
  comments: 5,
  responses: 8,
  completion: 10,
  gravity: 1.5,
  lookbackDays: 30,
};

/** Raw engagement inputs for one piece (mirrors the SQL columns). */
export interface TrendingInputs {
  claps: number;
  comments: number;
  responses: number;
  reads: number;
  views: number;
  publishedAt: Date;
}

/** The pure TS mirror of the SQL score — used by tests and any in-memory ranking. */
export function computeTrendingScore(
  input: TrendingInputs,
  weights: TrendingWeights,
  now: Date,
): number {
  const completionRate = input.views > 0 ? input.reads / input.views : 0;
  const engagement =
    weights.claps * input.claps +
    weights.comments * input.comments +
    weights.responses * input.responses +
    weights.completion * completionRate;
  const ageHours = Math.max(0, (now.getTime() - input.publishedAt.getTime()) / 3_600_000);
  const decay = Math.pow(ageHours + 2, weights.gravity);
  return decay > 0 ? engagement / decay : 0;
}

/**
 * The Postgres expression computing the same score, referencing the piece alias
 * (`p`, for `published_at`) and the stats alias (`ps`). Weights are bound as
 * named parameters (see {@link trendingScoreParams}) — never string-interpolated
 * (docs 13 §6). Returns the SQL fragment; the caller aliases it as `score`.
 */
export function buildTrendingScoreSql(pieceAlias = 'p', statsAlias = 'ps'): string {
  return `(
      :wClaps * COALESCE(${statsAlias}.claps_count, 0)
    + :wComments * COALESCE(${statsAlias}.comments_count, 0)
    + :wResponses * COALESCE(${statsAlias}.responses_count, 0)
    + :wCompletion * (COALESCE(${statsAlias}.reads_count, 0)::float
                      / GREATEST(COALESCE(${statsAlias}.views_count, 0), 1))
  ) / POWER(EXTRACT(EPOCH FROM (now() - ${pieceAlias}.published_at)) / 3600.0 + 2, :gravity)`;
}

/** Bound-parameter values for {@link buildTrendingScoreSql}. */
export function trendingScoreParams(weights: TrendingWeights): Record<string, number> {
  return {
    wClaps: weights.claps,
    wComments: weights.comments,
    wResponses: weights.responses,
    wCompletion: weights.completion,
    gravity: weights.gravity,
  };
}
