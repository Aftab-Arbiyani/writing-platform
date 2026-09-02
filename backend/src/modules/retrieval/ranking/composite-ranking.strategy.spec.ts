import { RankingSignal, RetrievalIntent, RetrievalQueryType, RetrievalSource } from '@qalam/shared';

import type { RetrievalCandidate, RetrievalPlan, RetrievalRequest } from '../retrieval.types';
import { CompositeRankingStrategy } from './composite-ranking.strategy';

const plan: RetrievalPlan = {
  intent: RetrievalIntent.Search,
  queryType: RetrievalQueryType.NaturalLanguage,
  sources: [RetrievalSource.KnowledgeGraph],
  parallel: false,
  candidatesPerSource: 40,
  topK: 10,
  contextTokens: 2000,
  timeoutMs: 8000,
  rankingSignals: [RankingSignal.SemanticSimilarity, RankingSignal.Popularity],
  rankingWeights: {
    [RankingSignal.SemanticSimilarity]: 1,
    [RankingSignal.Popularity]: 0.5,
  } as Record<RankingSignal, number>,
  nodeTypes: [],
};

const request: RetrievalRequest = {
  userId: 'u1',
  query: 'q',
  intent: RetrievalIntent.Search,
  limit: 10,
};

function candidate(id: string, sim: number, pop: number): RetrievalCandidate {
  return {
    id,
    source: RetrievalSource.KnowledgeGraph,
    type: 'character',
    title: id,
    summary: '',
    object: {},
    text: id,
    baseScore: sim,
    signals: { semantic_similarity: sim, popularity: pop },
    evidence: [],
    related: [],
    navigation: { kind: 'graph_node', ref: id },
  };
}

describe('CompositeRankingStrategy', () => {
  const ranker = new CompositeRankingStrategy();

  it('ranks by the weighted blend of signals and explains each result', () => {
    const ranked = ranker.rank(
      [candidate('low', 0.2, 0.9), candidate('high', 0.95, 0.1)],
      plan,
      request,
    );
    expect(ranked[0]?.id).toBe('high');
    expect(ranked[0]?.ranking.signals.length).toBeGreaterThan(0);
    expect(ranked[0]?.ranking.summary).toContain('strong match');
    // score is a weighted average of the two 0..1 signals → within [0,1].
    expect(ranked[0]?.score).toBeGreaterThan(0);
    expect(ranked[0]?.score).toBeLessThanOrEqual(1);
  });

  it('caps results at topK', () => {
    const many = Array.from({ length: 30 }, (_, i) => candidate(`c${i}`, i / 30, 0));
    expect(ranker.rank(many, plan, request)).toHaveLength(plan.topK);
  });

  it('falls back to baseScore when a candidate carries no weighted signals', () => {
    const bare: RetrievalCandidate = { ...candidate('x', 0, 0), signals: {} };
    bare.baseScore = 0.42;
    const [only] = ranker.rank([bare], plan, request);
    expect(only?.score).toBeCloseTo(0.42);
  });
});
