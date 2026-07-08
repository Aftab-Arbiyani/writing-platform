import {
  buildTrendingScoreSql,
  computeTrendingScore,
  DEFAULT_TRENDING_WEIGHTS,
  trendingScoreParams,
  type TrendingInputs,
} from './trending-scoring';

const now = new Date('2026-07-08T12:00:00.000Z');
const base: TrendingInputs = {
  claps: 0,
  comments: 0,
  responses: 0,
  reads: 0,
  views: 0,
  publishedAt: new Date('2026-07-08T11:00:00.000Z'), // 1h old
};

describe('computeTrendingScore', () => {
  it('rewards more engagement', () => {
    const low = computeTrendingScore({ ...base, claps: 5 }, DEFAULT_TRENDING_WEIGHTS, now);
    const high = computeTrendingScore({ ...base, claps: 50 }, DEFAULT_TRENDING_WEIGHTS, now);
    expect(high).toBeGreaterThan(low);
  });

  it('weights responses above comments above claps (per default weights)', () => {
    const oneClap = computeTrendingScore({ ...base, claps: 1 }, DEFAULT_TRENDING_WEIGHTS, now);
    const oneComment = computeTrendingScore(
      { ...base, comments: 1 },
      DEFAULT_TRENDING_WEIGHTS,
      now,
    );
    const oneResponse = computeTrendingScore(
      { ...base, responses: 1 },
      DEFAULT_TRENDING_WEIGHTS,
      now,
    );
    expect(oneComment).toBeGreaterThan(oneClap);
    expect(oneResponse).toBeGreaterThan(oneComment);
  });

  it('decays with age — a fresh piece outranks an old one with equal engagement', () => {
    const fresh = computeTrendingScore(
      { ...base, claps: 10, publishedAt: new Date(now.getTime() - 3_600_000) },
      DEFAULT_TRENDING_WEIGHTS,
      now,
    );
    const old = computeTrendingScore(
      { ...base, claps: 10, publishedAt: new Date(now.getTime() - 30 * 86_400_000) },
      DEFAULT_TRENDING_WEIGHTS,
      now,
    );
    expect(fresh).toBeGreaterThan(old);
  });

  it('folds in reading completion (reads ÷ views) without dividing by zero', () => {
    const noViews = computeTrendingScore(
      { ...base, reads: 0, views: 0 },
      DEFAULT_TRENDING_WEIGHTS,
      now,
    );
    const completed = computeTrendingScore(
      { ...base, reads: 80, views: 100 },
      DEFAULT_TRENDING_WEIGHTS,
      now,
    );
    expect(Number.isFinite(noViews)).toBe(true);
    expect(completed).toBeGreaterThan(noViews);
  });

  it('is configurable — zeroing every weight yields a zero score', () => {
    const zeroed = computeTrendingScore(
      { ...base, claps: 99, comments: 99, responses: 99, reads: 10, views: 10 },
      { claps: 0, comments: 0, responses: 0, completion: 0, gravity: 1.5, lookbackDays: 30 },
      now,
    );
    expect(zeroed).toBe(0);
  });
});

describe('buildTrendingScoreSql / params', () => {
  it('references the stats columns and binds weights as named params (no interpolation)', () => {
    const sql = buildTrendingScoreSql('p', 'ps');
    expect(sql).toContain('ps.claps_count');
    expect(sql).toContain('ps.comments_count');
    expect(sql).toContain('ps.responses_count');
    expect(sql).toContain(':wClaps');
    expect(sql).toContain(':gravity');
    expect(sql).toContain('p.published_at');
  });

  it('maps weights to bound parameters', () => {
    expect(trendingScoreParams(DEFAULT_TRENDING_WEIGHTS)).toEqual({
      wClaps: 3,
      wComments: 5,
      wResponses: 8,
      wCompletion: 10,
      gravity: 1.5,
    });
  });
});
