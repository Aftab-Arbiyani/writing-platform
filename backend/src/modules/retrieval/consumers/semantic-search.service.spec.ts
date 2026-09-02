import { ERROR_CODES, RetrievalIntent, RetrievalQueryType, RetrievalSource } from '@qalam/shared';

import type { RetrievalCacheService } from '../retrieval-cache.service';
import type { RetrievalService } from '../retrieval.service';
import type { RankedCandidate, RetrievalRequest, RetrievalResult } from '../retrieval.types';
import type { RetrievalTelemetryService } from '../observability/retrieval-telemetry.service';
import { SemanticSearchService } from './semantic-search.service';

function rankedFixture(): RankedCandidate {
  return {
    id: 'n1',
    source: RetrievalSource.KnowledgeGraph,
    type: 'character',
    title: 'Aria',
    summary: 'hero',
    object: { name: 'Aria' },
    text: 'Aria',
    baseScore: 0.9,
    score: 0.9,
    confidence: 0.85,
    ranking: { score: 0.9, signals: [], summary: 'strong match to your query' },
    evidence: [
      {
        source: RetrievalSource.KnowledgeGraph,
        ref: 'n1',
        label: 'Aria',
        quote: 'brave',
        score: 0.9,
      },
    ],
    related: [],
    navigation: { kind: 'graph_node', ref: 'n1' },
  };
}

function resultFixture(): RetrievalResult {
  return {
    plan: {
      intent: RetrievalIntent.Search,
      queryType: RetrievalQueryType.Character,
      sources: [RetrievalSource.KnowledgeGraph],
      parallel: false,
      candidatesPerSource: 40,
      topK: 10,
      contextTokens: 2000,
      timeoutMs: 8000,
      rankingSignals: [],
      rankingWeights: {} as never,
      nodeTypes: ['character'],
    },
    candidates: [rankedFixture()],
    context: { text: 'CTX', tokenCount: 10, compressionRatio: 1, fragments: 1, evidence: [] },
    telemetry: {
      intent: RetrievalIntent.Search,
      queryType: RetrievalQueryType.Character,
      sources: [],
      totalCandidates: 1,
      returned: 1,
      retrievalLatencyMs: 1,
      rankingLatencyMs: 1,
      contextAssemblyMs: 1,
      contextTokens: 10,
      compressionRatio: 1,
      cacheHit: false,
      evidenceCount: 0,
      confidence: 0.8,
      degraded: false,
      failureReason: null,
    },
  };
}

function makeService(result: RetrievalResult) {
  const retrieve = jest.fn().mockResolvedValue(result);
  const retrieval = { retrieve } as unknown as RetrievalService;
  const cache = {
    key: jest.fn().mockReturnValue('k'),
    remember: jest.fn(async (_k: string, _ttl: number, fn: () => Promise<RetrievalResult>) => ({
      value: await fn(),
      hit: false,
    })),
  } as unknown as RetrievalCacheService;
  const record = jest.fn().mockResolvedValue(undefined);
  const telemetry = { record } as unknown as RetrievalTelemetryService;
  return {
    service: new SemanticSearchService(retrieval, cache, telemetry),
    retrieve,
    record,
  };
}

describe('SemanticSearchService', () => {
  it('returns ranked, explained results and records telemetry', async () => {
    const { service, record } = makeService(resultFixture());
    const res = await service.search('u1', { query: 'who is aria' });

    expect(res.results[0]?.title).toBe('Aria');
    expect(res.results[0]?.reason).toContain('strong match');
    expect(record).toHaveBeenCalled();
  });

  /**
   * D5: the engine calls no LLM at all. `answer` survives on the wire for one release so a
   * client built against the old shape keeps compiling, but nothing can populate it — and no
   * LLM latency or token cost is ever attributed to a search.
   */
  it('never answers in prose, whatever the caller asks for', async () => {
    const { service, record } = makeService(resultFixture());
    const res = await service.search('u1', { query: 'who is aria', synthesize: true });

    expect(res.answer).toBeNull();
    const recorded = (record.mock.calls[0] as unknown[])[0] as {
      llmLatencyMs: number;
      tokenUsage: number;
    };
    expect(recorded.llmLatencyMs).toBe(0);
    expect(recorded.tokenUsage).toBe(0);
  });

  describe('anonymous callers (search is public since D5)', () => {
    it('searches the library with a null viewer', async () => {
      const { service, retrieve, record } = makeService(resultFixture());
      const res = await service.search(null, { query: 'who is aria' });

      expect(res.results[0]?.title).toBe('Aria');
      const request = (retrieve.mock.calls[0] as unknown[])[0] as RetrievalRequest;
      expect(request.userId).toBeNull();
      const recorded = (record.mock.calls[0] as unknown[])[0] as { userId: string | null };
      expect(recorded.userId).toBeNull();
    });

    /**
     * A story-scoped plan draws only on the owner-scoped graph and the inert vector source, so
     * an anonymous caller would otherwise get an empty result that reads like "this story is
     * empty" rather than "you are not signed in". Refuse, and say which it is.
     */
    it('refuses a story-scoped search instead of returning a misleading empty result', async () => {
      const { service, retrieve } = makeService(resultFixture());

      await expect(
        service.search(null, { query: 'who is aria', storyId: 's1' }),
      ).rejects.toMatchObject({ code: ERROR_CODES.RETRIEVAL_QUERY_INVALID });
      expect(retrieve).not.toHaveBeenCalled();
    });

    it('refuses story-scoped suggestions on the same rule', async () => {
      const { service, retrieve } = makeService(resultFixture());

      await expect(service.suggestions(null, 'ari', 's1')).rejects.toMatchObject({
        code: ERROR_CODES.RETRIEVAL_QUERY_INVALID,
      });
      expect(retrieve).not.toHaveBeenCalled();
    });

    it('serves library suggestions', async () => {
      const { service } = makeService(resultFixture());

      await expect(service.suggestions(null, 'ari')).resolves.toEqual(['Aria']);
    });
  });
});
