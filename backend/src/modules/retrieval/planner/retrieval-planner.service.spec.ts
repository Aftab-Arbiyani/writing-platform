import { AskScope, RetrievalIntent, RetrievalQueryType, RetrievalSource } from '@qalam/shared';

import { DEFAULT_RETRIEVAL_CONFIG } from '../retrieval.constants';
import type { RetrievalRequest } from '../retrieval.types';
import { RetrievalPlannerService } from './retrieval-planner.service';

describe('RetrievalPlannerService', () => {
  const planner = new RetrievalPlannerService();
  const base: RetrievalRequest = {
    userId: 'u1',
    query: 'the queen',
    intent: RetrievalIntent.Search,
    limit: 0,
  };

  it('story-scoped searches use the knowledge graph, not keyword/metadata', () => {
    const plan = planner.plan({ ...base, storyId: 'piece-1' }, DEFAULT_RETRIEVAL_CONFIG);
    expect(plan.sources).toContain(RetrievalSource.KnowledgeGraph);
    expect(plan.sources).not.toContain(RetrievalSource.Keyword);
  });

  it('library searches use keyword + metadata, not the graph', () => {
    const plan = planner.plan(base, DEFAULT_RETRIEVAL_CONFIG);
    expect(plan.sources).toEqual(
      expect.arrayContaining([RetrievalSource.Keyword, RetrievalSource.Metadata]),
    );
    expect(plan.sources).not.toContain(RetrievalSource.KnowledgeGraph);
  });

  it('maps query type to prioritised graph node types', () => {
    const plan = planner.plan(
      { ...base, storyId: 's', queryType: RetrievalQueryType.Character },
      DEFAULT_RETRIEVAL_CONFIG,
    );
    expect(plan.nodeTypes).toEqual(['character']);
  });

  it('an ask uses its scope node types and always synthesises', () => {
    const plan = planner.plan(
      { ...base, intent: RetrievalIntent.Ask, storyId: 's', scope: AskScope.Timeline },
      DEFAULT_RETRIEVAL_CONFIG,
    );
    expect(plan.nodeTypes).toEqual(['event']);
    expect(plan.synthesize).toBe(true);
  });

  it('a search only synthesises when requested and enabled', () => {
    expect(planner.plan(base, DEFAULT_RETRIEVAL_CONFIG).synthesize).toBe(false);
    expect(planner.plan({ ...base, synthesize: true }, DEFAULT_RETRIEVAL_CONFIG).synthesize).toBe(
      true,
    );
  });

  it('drops sources disabled in config and clamps topK', () => {
    const cfg = {
      ...DEFAULT_RETRIEVAL_CONFIG,
      topK: 5,
      sources: { ...DEFAULT_RETRIEVAL_CONFIG.sources, [RetrievalSource.Metadata]: false },
    };
    const plan = planner.plan({ ...base, limit: 999 }, cfg);
    expect(plan.sources).not.toContain(RetrievalSource.Metadata);
    expect(plan.topK).toBe(5);
  });

  it('orders ranking signals by descending weight', () => {
    const plan = planner.plan(base, DEFAULT_RETRIEVAL_CONFIG);
    const weights = plan.rankingSignals.map((s) => plan.rankingWeights[s]);
    const sorted = [...weights].sort((a, b) => b - a);
    expect(weights).toEqual(sorted);
  });
});
