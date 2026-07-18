import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES, RetrievalIntent, RetrievalSource } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';
import { ContextAssemblerService } from './context/context-assembler.service';
import { EvidenceService } from './evidence/evidence.service';
import { QueryClassifierService } from './planner/query-classifier.service';
import { RetrievalPlannerService } from './planner/retrieval-planner.service';
import type { RankingStrategy } from './ports/ranking.port';
import type { Retriever } from './ports/retriever.port';
import { CompositeRankingStrategy } from './ranking/composite-ranking.strategy';
import type { RetrievalConfigService } from './retrieval-config.service';
import { DEFAULT_RETRIEVAL_CONFIG } from './retrieval.constants';
import { RetrievalFailedException } from './retrieval.exceptions';
import { RetrievalService } from './retrieval.service';
import type { RetrievalCandidate } from './retrieval.types';

class StoryNotFoundStub extends AppException {
  constructor() {
    super(ERROR_CODES.STORY_NOT_FOUND, 'not found', HttpStatus.NOT_FOUND);
  }
}

function candidate(id: string, source: RetrievalSource): RetrievalCandidate {
  return {
    id,
    source,
    type: 'character',
    title: id,
    summary: '',
    object: {},
    text: id,
    baseScore: 0.8,
    signals: { semantic_similarity: 0.8 },
    evidence: [],
    related: [],
    navigation: { kind: 'graph_node', ref: id },
  };
}

function fakeRetriever(
  source: RetrievalSource,
  behaviour: { available?: boolean; candidates?: RetrievalCandidate[]; error?: Error },
): Retriever {
  return {
    source,
    isAvailable: () => behaviour.available ?? true,
    retrieve: behaviour.error
      ? jest.fn().mockRejectedValue(behaviour.error)
      : jest.fn().mockResolvedValue(behaviour.candidates ?? []),
  };
}

function makeService(retrievers: Retriever[], ranking?: RankingStrategy): RetrievalService {
  const config = {
    getConfig: jest.fn().mockResolvedValue(DEFAULT_RETRIEVAL_CONFIG),
  } as unknown as RetrievalConfigService;
  return new RetrievalService(
    retrievers,
    ranking ?? new CompositeRankingStrategy(),
    new RetrievalPlannerService(),
    new QueryClassifierService(),
    new ContextAssemblerService(),
    new EvidenceService(),
    config,
  );
}

const storyReq = {
  userId: 'u1',
  query: 'Aria',
  intent: RetrievalIntent.Search,
  storyId: 'piece-1',
  limit: 10,
};

describe('RetrievalService', () => {
  it('runs only the planned, available sources and ranks + assembles the result', async () => {
    const graph = fakeRetriever(RetrievalSource.KnowledgeGraph, {
      candidates: [candidate('n1', RetrievalSource.KnowledgeGraph)],
    });
    const vector = fakeRetriever(RetrievalSource.Vector, { available: false });
    const keyword = fakeRetriever(RetrievalSource.Keyword, {
      candidates: [candidate('p1', RetrievalSource.Keyword)],
    });

    const result = await makeService([graph, vector, keyword]).retrieve(storyReq);

    // Story-scoped plan → only the graph source; keyword is not in the plan; vector inert.
    expect(result.candidates.map((c) => c.id)).toEqual(['n1']);
    expect(result.telemetry.sources.map((s) => s.source)).toEqual([RetrievalSource.KnowledgeGraph]);
    expect(keyword.retrieve).not.toHaveBeenCalled();
    expect(vector.retrieve).not.toHaveBeenCalled();
  });

  it('degrades gracefully when a source fails but another succeeds', async () => {
    const keyword = fakeRetriever(RetrievalSource.Keyword, {
      candidates: [candidate('p1', RetrievalSource.Keyword)],
    });
    const metadata = fakeRetriever(RetrievalSource.Metadata, { error: new Error('db blip') });

    const result = await makeService([keyword, metadata]).retrieve({
      ...storyReq,
      storyId: undefined,
    });

    expect(result.telemetry.degraded).toBe(true);
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('surfaces STORY_NOT_FOUND from the graph source (does not degrade it)', async () => {
    const graph = fakeRetriever(RetrievalSource.KnowledgeGraph, { error: new StoryNotFoundStub() });
    await expect(makeService([graph]).retrieve(storyReq)).rejects.toBeInstanceOf(StoryNotFoundStub);
  });

  it('throws RETRIEVAL_FAILED when every attempted source fails', async () => {
    const keyword = fakeRetriever(RetrievalSource.Keyword, { error: new Error('x') });
    const metadata = fakeRetriever(RetrievalSource.Metadata, { error: new Error('y') });
    await expect(
      makeService([keyword, metadata]).retrieve({ ...storyReq, storyId: undefined }),
    ).rejects.toBeInstanceOf(RetrievalFailedException);
  });
});
