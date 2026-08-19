import type { SearchAnalytics } from '@qalam/api-types';
import {
  RankingSignal,
  RetrievalFailureReason,
  RetrievalIntent,
  RetrievalQueryType,
  RetrievalSource,
} from '@qalam/shared';
import { describe, expect, it } from 'vitest';

import {
  asPercent,
  FAILURE_LABELS,
  INTENT_LABELS,
  QUERY_TYPE_LABELS,
  searchAnalyticsIsEmpty,
  SIGNAL_LABELS,
  SOURCE_HINTS,
  SOURCE_LABELS,
  SOURCE_ORDER,
} from './retrieval-labels';

/**
 * The label maps are `satisfies Record<Enum, string>`, so a MISSING key already fails the build.
 * What that cannot catch is the reverse: an enum member renamed in `@qalam/shared` while a stale
 * label survives under the old key, which renders a raw token to an operator. These assert the
 * key sets are equal, which closes that direction.
 */

const analytics = (overrides: Partial<SearchAnalytics> = {}): SearchAnalytics => ({
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
  ...overrides,
});

describe('retrieval label maps', () => {
  it.each([
    ['sources', SOURCE_LABELS, Object.values(RetrievalSource)],
    ['source hints', SOURCE_HINTS, Object.values(RetrievalSource)],
    ['ranking signals', SIGNAL_LABELS, Object.values(RankingSignal)],
    ['intents', INTENT_LABELS, Object.values(RetrievalIntent)],
    ['query types', QUERY_TYPE_LABELS, Object.values(RetrievalQueryType)],
    ['failure reasons', FAILURE_LABELS, Object.values(RetrievalFailureReason)],
  ])('names every %s member exactly once', (_name, labels, members) => {
    expect(Object.keys(labels).sort()).toEqual([...members].sort());
    expect(Object.values(labels).every((label) => label.length > 0)).toBe(true);
  });

  it('orders the sources the way the planner runs them, graph first', () => {
    expect(SOURCE_ORDER[0]).toBe(RetrievalSource.KnowledgeGraph);
    expect([...SOURCE_ORDER].sort()).toEqual(Object.values(RetrievalSource).sort());
  });

  it('says out loud that the vector source does nothing yet', () => {
    expect(SOURCE_HINTS[RetrievalSource.Vector]).toMatch(/unavailable|nothing today/i);
  });
});

describe('searchAnalyticsIsEmpty', () => {
  it('treats a window with no requests as empty', () => {
    expect(searchAnalyticsIsEmpty(analytics())).toBe(true);
  });

  it('treats one request as data, however unremarkable its figures are', () => {
    // Every rate is legitimately 0 here — a single fast, confident, cached-miss request. The page
    // must still render it, because the absence and the measurement are different claims.
    expect(searchAnalyticsIsEmpty(analytics({ totalQueries: 1 }))).toBe(false);
  });
});

describe('asPercent', () => {
  it('reads a 0..1 rate as a percentage to one decimal', () => {
    expect(asPercent(0)).toBe('0.0%');
    expect(asPercent(0.25)).toBe('25.0%');
    expect(asPercent(0.333)).toBe('33.3%');
    expect(asPercent(1)).toBe('100.0%');
  });
});
