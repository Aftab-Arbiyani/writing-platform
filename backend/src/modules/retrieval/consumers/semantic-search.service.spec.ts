import { RetrievalIntent, RetrievalQueryType, RetrievalSource } from '@qalam/shared';

import type { AiCompletionService, AiFeatureService } from '../../ai';
import type { RetrievalCacheService } from '../retrieval-cache.service';
import type { RetrievalConfigService } from '../retrieval-config.service';
import { DEFAULT_RETRIEVAL_CONFIG } from '../retrieval.constants';
import type { RetrievalService } from '../retrieval.service';
import type { RankedCandidate, RetrievalResult } from '../retrieval.types';
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

function resultFixture(synthesize: boolean): RetrievalResult {
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
      synthesize,
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

function makeService(result: RetrievalResult, synthesisEnabled = true) {
  const retrieval = {
    retrieve: jest.fn().mockResolvedValue(result),
  } as unknown as RetrievalService;
  const complete = jest.fn().mockResolvedValue({
    content: 'A grounded answer.',
    usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
    costUsd: 0,
  });
  const completion = { complete } as unknown as AiCompletionService;
  const assertEnabled = jest.fn().mockResolvedValue(undefined);
  const features = { assertEnabled } as unknown as AiFeatureService;
  const cache = {
    key: jest.fn().mockReturnValue('k'),
    remember: jest.fn(async (_k: string, _ttl: number, fn: () => Promise<RetrievalResult>) => ({
      value: await fn(),
      hit: false,
    })),
  } as unknown as RetrievalCacheService;
  const telemetry = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as RetrievalTelemetryService;
  const config = {
    getConfig: jest.fn().mockResolvedValue({ ...DEFAULT_RETRIEVAL_CONFIG, synthesisEnabled }),
  } as unknown as RetrievalConfigService;
  return {
    service: new SemanticSearchService(retrieval, completion, features, cache, telemetry, config),
    complete,
    assertEnabled,
    telemetry,
  };
}

describe('SemanticSearchService', () => {
  it('gates the feature, returns ranked/explained results, and records telemetry', async () => {
    const { service, complete, assertEnabled, telemetry } = makeService(resultFixture(false));
    const res = await service.search('u1', { query: 'who is aria' });

    expect(assertEnabled).toHaveBeenCalled();
    expect(res.results[0]?.title).toBe('Aria');
    expect(res.results[0]?.reason).toContain('strong match');
    expect(res.answer).toBeNull(); // no synthesis requested
    expect(complete).not.toHaveBeenCalled();
    expect(telemetry.record).toHaveBeenCalled();
  });

  it('synthesises a grounded answer through the AF1 orchestrator when requested', async () => {
    const { service, complete } = makeService(resultFixture(true));
    const res = await service.search('u1', { query: 'who is aria', synthesize: true });

    expect(complete).toHaveBeenCalledTimes(1);
    const input = (complete.mock.calls[0] as unknown[])[0] as {
      promptKey: string;
      promptVariables: { context: string };
    };
    expect(input.promptKey).toBe('semantic_search.answer');
    expect(input.promptVariables.context).toBe('CTX'); // grounded on assembled context, not raw query
    expect(res.answer).toBe('A grounded answer.');
  });

  /**
   * The defect the W5 browser run found (docs/48 §3.9 W5-8): synthesis used to be gated on
   * `result.plan.synthesize`, and the plan rides inside the CACHED retrieval result whose key has no
   * `synthesize` in it. So a reader who loaded results and then pressed "Explain these results" hit the
   * plan cached by their own first request — `synthesize: false` — and never got an answer.
   *
   * The fixture below is exactly that state: a cached plan that says no, a request that says yes.
   */
  it('synthesises on the REQUEST, not on a cached plan that predates it', async () => {
    const { service, complete } = makeService(resultFixture(false));
    const res = await service.search('u1', { query: 'who is aria', synthesize: true });

    expect(complete).toHaveBeenCalledTimes(1);
    expect(res.answer).toBe('A grounded answer.');
  });

  it('still refuses synthesis when the admin switch is off', async () => {
    // The one thing `plan.synthesize` carried that the request does not — read from the config
    // directly, so it keeps working and keeps being request-scoped.
    const { service, complete } = makeService(resultFixture(true), false);
    const res = await service.search('u1', { query: 'who is aria', synthesize: true });

    expect(complete).not.toHaveBeenCalled();
    expect(res.answer).toBeNull();
  });
});
