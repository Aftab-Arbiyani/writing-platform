import { RetrievalSource } from '@qalam/shared';

import type { RankedCandidate } from '../retrieval.types';
import { ContextAssemblerService } from './context-assembler.service';

function ranked(id: string, title: string, text: string): RankedCandidate {
  return {
    id,
    source: RetrievalSource.KnowledgeGraph,
    type: 'character',
    title,
    summary: text,
    object: {},
    text,
    baseScore: 1,
    score: 1,
    confidence: 0.9,
    ranking: { score: 1, signals: [], summary: '' },
    evidence: [
      {
        source: RetrievalSource.KnowledgeGraph,
        ref: id,
        label: title,
        quote: `${title} quote`,
        score: 1,
      },
    ],
    related: [],
    navigation: { kind: 'graph_node', ref: id },
  };
}

describe('ContextAssemblerService', () => {
  const svc = new ContextAssemblerService();

  it('assembles fragments within the token budget and reports compression', () => {
    const long = 'lorem ipsum '.repeat(200);
    const ctx = svc.assemble([ranked('a', 'Aria', long), ranked('b', 'Kael', long)], 100);
    expect(ctx.tokenCount).toBeLessThanOrEqual(140); // budget + fragment overhead tolerance
    expect(ctx.compressionRatio).toBeGreaterThan(1); // long input was compressed
    expect(ctx.fragments).toBeGreaterThan(0);
  });

  it('deduplicates repeated ids and same-title entities across sources', () => {
    const dup = { ...ranked('a', 'Aria', 'x'), source: RetrievalSource.Keyword };
    const ctx = svc.assemble([ranked('a', 'Aria', 'x'), dup], 2000);
    expect(ctx.fragments).toBe(1);
  });

  it('collects deduplicated evidence, highest-scored first', () => {
    const ctx = svc.assemble([ranked('a', 'Aria', 'x'), ranked('b', 'Kael', 'y')], 2000);
    expect(ctx.evidence).toHaveLength(2);
    expect(ctx.evidence[0]?.score).toBeGreaterThanOrEqual(ctx.evidence[1]?.score ?? 0);
  });

  it('handles an empty candidate set', () => {
    const ctx = svc.assemble([], 2000);
    expect(ctx.text).toBe('');
    expect(ctx.fragments).toBe(0);
    expect(ctx.evidence).toHaveLength(0);
  });
});
