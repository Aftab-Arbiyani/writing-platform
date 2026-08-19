import { RetrievalFailureReason, RetrievalIntent, RetrievalQueryType } from '@qalam/shared';

import type { RetrievalQueryLog } from '../entities/retrieval-query-log.entity';
import { ANALYTICS_ROW_CAP, RetrievalLogRepository } from './retrieval-log.repository';
import { RetrievalTelemetryService } from './retrieval-telemetry.service';

/**
 * Search Analytics (AF4) — the aggregation A3's dashboard reads, and the first consumer this
 * endpoint has ever had. Two defects it would have shipped on top of, both fixed with A3:
 *
 * - **`avgConfidence` was rounded to a whole number.** Confidence is a `real` in 0..1
 *   (`retrieval-query-log.entity.ts`), and it shared the integer `mean` used for milliseconds and
 *   token counts — so every possible average came back as exactly 0 or 1, and a dashboard built on
 *   it would have shown a fabricated figure rather than a wrong one.
 * - **The window was truncated in silence.** The repository caps the read at
 *   `ANALYTICS_ROW_CAP` rows, newest first, and nothing in the response said so, so a busy install
 *   reported exactly the cap as its query count and every derived rate described only the newest
 *   slice. `truncated` now carries it, because a surface cannot label a sample it cannot detect.
 */

function log(overrides: Partial<RetrievalQueryLog> = {}): RetrievalQueryLog {
  return {
    intent: RetrievalIntent.Search,
    queryType: RetrievalQueryType.NaturalLanguage,
    totalLatencyMs: 100,
    returned: 5,
    cacheHit: false,
    confidence: 0.5,
    contextTokens: 1000,
    failureReason: null,
    ...overrides,
  } as RetrievalQueryLog;
}

function build(rows: RetrievalQueryLog[]) {
  const repo = { since: jest.fn().mockResolvedValue(rows), record: jest.fn() };
  return {
    service: new RetrievalTelemetryService(repo as unknown as RetrievalLogRepository),
    repo,
  };
}

describe('RetrievalTelemetryService.getAnalytics', () => {
  afterEach(() => jest.clearAllMocks());

  it('reports an empty window without inventing figures', async () => {
    const { service } = build([]);

    const analytics = await service.getAnalytics(7);

    expect(analytics).toEqual({
      window: '7d',
      totalQueries: 0,
      truncated: false,
      byIntent: [],
      byQueryType: [],
      zeroResultRate: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      avgConfidence: 0,
      cacheHitRatio: 0,
      avgContextTokens: 0,
      failureBreakdown: [],
    });
  });

  it('labels the window with the days requested and queries from that boundary', async () => {
    const { service, repo } = build([log()]);

    const analytics = await service.getAnalytics(30);

    expect(analytics.window).toBe('30d');
    const from = repo.since.mock.calls[0]?.[0] as Date;
    const days = (Date.now() - from.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it('keeps avgConfidence on its real 0..1 scale', async () => {
    const { service } = build([
      log({ confidence: 0.9 }),
      log({ confidence: 0.7 }),
      log({ confidence: 0.5 }),
    ]);

    // Rounded to a whole number this was 1 — the same answer 0.51 and 1.0 would have given.
    await expect(service.getAnalytics(7)).resolves.toMatchObject({ avgConfidence: 0.7 });
  });

  it('does not round a low average confidence away to zero', async () => {
    const { service } = build([log({ confidence: 0.2 }), log({ confidence: 0.1 })]);

    await expect(service.getAnalytics(7)).resolves.toMatchObject({ avgConfidence: 0.15 });
  });

  it('still reports latency and context tokens as whole units', async () => {
    const { service } = build([
      log({ totalLatencyMs: 100, contextTokens: 1000 }),
      log({ totalLatencyMs: 201, contextTokens: 1501 }),
    ]);

    const analytics = await service.getAnalytics(7);

    expect(analytics.avgLatencyMs).toBe(151);
    expect(analytics.avgContextTokens).toBe(1251);
  });

  it('flags a truncated window, so the figures can be labelled a sample', async () => {
    const { service } = build(Array.from({ length: ANALYTICS_ROW_CAP }, () => log()));

    const analytics = await service.getAnalytics(90);

    expect(analytics.truncated).toBe(true);
    expect(analytics.totalQueries).toBe(ANALYTICS_ROW_CAP);
  });

  it('does not flag a window that fits under the cap', async () => {
    const { service } = build(Array.from({ length: ANALYTICS_ROW_CAP - 1 }, () => log()));

    await expect(service.getAnalytics(90)).resolves.toMatchObject({ truncated: false });
  });

  it('counts intents and query types, most frequent first', async () => {
    const { service } = build([
      log({ intent: RetrievalIntent.Ask }),
      log({ intent: RetrievalIntent.Search }),
      log({ intent: RetrievalIntent.Search }),
      log({ queryType: RetrievalQueryType.Character }),
    ]);

    const analytics = await service.getAnalytics(7);

    expect(analytics.byIntent).toEqual([
      { intent: RetrievalIntent.Search, count: 3 },
      { intent: RetrievalIntent.Ask, count: 1 },
    ]);
    expect(analytics.byQueryType[0]).toEqual({
      queryType: RetrievalQueryType.NaturalLanguage,
      count: 3,
    });
  });

  it('derives the zero-result and cache-hit rates as fractions of the sample', async () => {
    const { service } = build([
      log({ returned: 0, cacheHit: true }),
      log({ returned: 3, cacheHit: true }),
      log({ returned: 3 }),
      log({ returned: 3 }),
    ]);

    const analytics = await service.getAnalytics(7);

    expect(analytics.zeroResultRate).toBe(0.25);
    expect(analytics.cacheHitRatio).toBe(0.5);
  });

  it('breaks down only the requests that actually failed', async () => {
    const { service } = build([
      log(),
      log({ failureReason: RetrievalFailureReason.Timeout }),
      log({ failureReason: RetrievalFailureReason.Timeout }),
      log({ failureReason: RetrievalFailureReason.NoResults }),
    ]);

    const analytics = await service.getAnalytics(7);

    expect(analytics.failureBreakdown).toEqual([
      { reason: RetrievalFailureReason.Timeout, count: 2 },
      { reason: RetrievalFailureReason.NoResults, count: 1 },
    ]);
  });

  it('takes p95 from the sorted latencies', async () => {
    const rows = [10, 20, 30, 40, 50, 60, 70, 80, 90, 1000].map((ms) =>
      log({ totalLatencyMs: ms }),
    );
    const { service } = build(rows);

    await expect(service.getAnalytics(7)).resolves.toMatchObject({ p95LatencyMs: 1000 });
  });
});
