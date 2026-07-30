import { RetrievalSource } from '@qalam/shared';

import type { RankedCandidate } from '../retrieval.types';
import { EvidenceService } from './evidence.service';

function ranked(id: string, confidence: number, quotes: string[]): RankedCandidate {
  return {
    id,
    source: RetrievalSource.KnowledgeGraph,
    type: 'character',
    title: id,
    summary: '',
    object: {},
    text: '',
    baseScore: confidence,
    score: confidence,
    confidence,
    ranking: { score: confidence, signals: [], summary: '' },
    evidence: quotes.map((q, i) => ({
      source: RetrievalSource.KnowledgeGraph,
      ref: id,
      label: id,
      quote: q,
      score: confidence - i * 0.01,
    })),
    related: [],
    navigation: { kind: 'graph_node', ref: id },
  };
}

describe('EvidenceService', () => {
  const svc = new EvidenceService();

  it('collects deduplicated evidence (by ref+quote)', () => {
    const a = ranked('a', 0.9, ['same', 'same', 'other']);
    const collected = svc.collect([a]);
    expect(collected).toHaveLength(2); // 'same' deduped
  });

  it('maps evidence to citations', () => {
    const citations = svc.toCitations([
      {
        source: RetrievalSource.KnowledgeGraph,
        ref: 'n1',
        label: 'Aria',
        quote: 'brave',
        score: 1,
      },
    ]);
    expect(citations[0]).toEqual({ ref: 'n1', label: 'Aria', quote: 'brave' });
  });

  it('damps aggregate confidence when there are few results', () => {
    const one = svc.aggregateConfidence([ranked('a', 0.9, ['q'])]);
    const many = svc.aggregateConfidence([
      ranked('a', 0.9, ['q']),
      ranked('b', 0.9, ['q']),
      ranked('c', 0.9, ['q']),
    ]);
    expect(many).toBeGreaterThan(one); // thin evidence → lower confidence
    expect(svc.aggregateConfidence([])).toBe(0);
  });
});
