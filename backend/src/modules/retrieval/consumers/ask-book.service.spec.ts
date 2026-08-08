import {
  AiFeature,
  AskScope,
  RetrievalIntent,
  RetrievalQueryType,
  RetrievalSource,
} from '@qalam/shared';

import type { AiCompletionService, AiFeatureService } from '../../ai';
import { EvidenceService } from '../evidence/evidence.service';
import type { RetrievalTelemetryService } from '../observability/retrieval-telemetry.service';
import type { RetrievalService } from '../retrieval.service';
import type { RetrievalResult } from '../retrieval.types';
import { AskBookService } from './ask-book.service';

function resultFixture(): RetrievalResult {
  return {
    plan: {
      intent: RetrievalIntent.Ask,
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
      synthesize: true,
    },
    candidates: [],
    context: {
      text: 'Aria is the protagonist.',
      tokenCount: 8,
      compressionRatio: 1,
      fragments: 1,
      evidence: [
        {
          source: RetrievalSource.KnowledgeGraph,
          ref: 'n1',
          label: 'Aria',
          quote: 'brave hero',
          score: 0.9,
        },
      ],
    },
    telemetry: {
      intent: RetrievalIntent.Ask,
      queryType: RetrievalQueryType.Character,
      sources: [],
      totalCandidates: 1,
      returned: 1,
      retrievalLatencyMs: 1,
      rankingLatencyMs: 1,
      contextAssemblyMs: 1,
      contextTokens: 8,
      compressionRatio: 1,
      cacheHit: false,
      evidenceCount: 1,
      confidence: 0.8,
      degraded: false,
      failureReason: null,
    },
  };
}

describe('AskBookService', () => {
  it('grounds the answer in retrieved evidence and cites it', async () => {
    const retrieve = jest.fn().mockResolvedValue(resultFixture());
    const retrieval = { retrieve } as unknown as RetrievalService;
    const complete = jest.fn().mockResolvedValue({
      content: 'Aria is the protagonist. [ch1]',
      usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
      costUsd: 0,
      conversationId: null,
    });
    const completion = { complete } as unknown as AiCompletionService;
    const assertEnabled = jest.fn().mockResolvedValue(undefined);
    const features = { assertEnabled } as unknown as AiFeatureService;
    const telemetry = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as RetrievalTelemetryService;

    const service = new AskBookService(
      retrieval,
      completion,
      features,
      new EvidenceService(),
      telemetry,
    );
    const res = await service.ask('u1', { storyId: 'piece-1', question: 'who is aria?' });

    // B5: the gate is called WITH the caller's id — it is the per-user switch's only input.
    expect(assertEnabled).toHaveBeenCalledWith(AiFeature.AskBook, 'u1');
    const input = (complete.mock.calls[0] as unknown[])[0] as {
      feature: string;
      promptKey: string;
      promptVariables: { scope: string; context: string };
    };
    expect(input.feature).toBe(AiFeature.AskBook);
    expect(input.promptKey).toBe('ask_book.answer');
    expect(input.promptVariables.scope).toBe(AskScope.Book); // default scope
    expect(input.promptVariables.context).toContain('Aria is the protagonist');
    expect(res.answer).toContain('Aria');
    expect(res.citations[0]).toEqual({ ref: 'n1', label: 'Aria', quote: 'brave hero' });
    expect(retrieve).toHaveBeenCalled();
  });
});
