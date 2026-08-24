import { AiFeature, StoryAnalysisKind, StoryAnalysisScope } from '@qalam/shared';

import type { AiCompletionService } from '../ai/orchestration/ai-completion.service';
import type { EntitlementService } from '../monetization/entitlement.service';
import type { MonetizationFeatureService } from '../monetization/monetization.feature-service';
import type { StoryAnalysis } from './entities/story-analysis.entity';
import type { StoryGraph } from './entities/story-graph.entity';
import { StoryIntelligenceService } from './story-intelligence.service';
import type { StoryIntelligenceRepository } from './story-intelligence.repository';
import {
  StoryAnalysisNotFoundException,
  StoryContentEmptyException,
  StoryNotFoundException,
} from './story.exceptions';

const CHARACTER_JSON = JSON.stringify({
  characters: [{ name: 'Aria', role: 'protagonist' }],
  relationships: [],
  summary: 'A hero.',
  confidence: 80,
  affectedCharacters: ['Aria'],
});

function completionOutput(content: string): unknown {
  return {
    conversationId: null,
    content,
    model: 'gpt-4o',
    provider: 'openai',
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    costUsd: 0.01,
    messageId: null,
  };
}

const graph = { id: 'g1', userId: 'u1', storyId: 'piece-1' } as unknown as StoryGraph;

function makeService(overrides: {
  complete?: jest.Mock;
  repo?: Partial<Record<keyof StoryIntelligenceRepository, jest.Mock>>;
  paymentsEnabled?: boolean;
  assertAllowed?: jest.Mock;
}): {
  service: StoryIntelligenceService;
  complete: jest.Mock;
  repo: Partial<Record<keyof StoryIntelligenceRepository, jest.Mock>>;
  assertAllowed: jest.Mock;
  isEnabled: jest.Mock;
} {
  const complete =
    overrides.complete ?? jest.fn().mockResolvedValue(completionOutput(CHARACTER_JSON));
  const completion = { complete } as unknown as AiCompletionService;
  const repo = {
    getOrCreateGraph: jest.fn().mockResolvedValue(graph),
    applyAnalysis: jest.fn().mockResolvedValue({ id: 'a1' } as unknown as StoryAnalysis),
    findGraph: jest.fn().mockResolvedValue(graph),
    findAnalysis: jest.fn(),
    listNodes: jest.fn().mockResolvedValue([]),
    listEdges: jest.fn().mockResolvedValue([]),
    listAnalyses: jest.fn().mockResolvedValue([]),
    deleteGraph: jest.fn().mockResolvedValue(undefined),
    ...overrides.repo,
  };
  // Entitled by default — these tests are about graph logic, not gating. The gate's
  // own behaviour (denied/dark-launch) is covered separately, per call site, below.
  const isEnabled = jest.fn().mockResolvedValue(overrides.paymentsEnabled ?? true);
  const feature = { isEnabled } as unknown as MonetizationFeatureService;
  const assertAllowed = overrides.assertAllowed ?? jest.fn().mockResolvedValue(undefined);
  const entitlements = { assertAllowed } as unknown as EntitlementService;
  const service = new StoryIntelligenceService(
    completion,
    repo as unknown as StoryIntelligenceRepository,
    feature,
    entitlements,
  );
  return { service, complete, repo, assertAllowed, isEnabled };
}

describe('StoryIntelligenceService', () => {
  describe('analyze', () => {
    it('reuses the AF1 orchestrator with the kind feature + prompt key, then persists', async () => {
      const { service, complete, repo } = makeService({});

      await service.analyze('u1', 'piece-1', {
        kind: StoryAnalysisKind.Character,
        scope: StoryAnalysisScope.Chapter,
        content: 'Aria walked into the dark forest.',
        storyTitle: 'The Wanderer',
      });

      expect(complete).toHaveBeenCalledTimes(1);
      const input = (complete.mock.calls[0] as unknown[])[0] as {
        feature: string;
        promptKey: string;
        messages: Array<{ content: string }>;
      };
      expect(input.feature).toBe(AiFeature.CharacterAnalysis);
      expect(input.promptKey).toBe('story.character');
      expect(input.messages[0]?.content).toBe('Aria walked into the dark forest.');

      // The structured parse is folded into the graph with usage/provenance.
      const applyCall = (repo.applyAnalysis as jest.Mock).mock.calls[0] as unknown[];
      expect(applyCall[1]).toBe(StoryAnalysisKind.Character);
      expect(applyCall[2]).toBe(StoryAnalysisScope.Chapter);
      const parsed = applyCall[4] as { nodes: unknown[] };
      expect(parsed.nodes.length).toBeGreaterThan(0);
      const meta = applyCall[5] as { totalTokens: number; costUsd: number; provider: string };
      expect(meta.totalTokens).toBe(30);
      expect(meta.costUsd).toBe(0.01);
      expect(meta.provider).toBe('openai');
    });

    it('rejects empty content before calling the orchestrator', async () => {
      const { service, complete } = makeService({});
      await expect(
        service.analyze('u1', 'piece-1', {
          kind: StoryAnalysisKind.Character,
          scope: StoryAnalysisScope.Book,
          content: '   ',
        }),
      ).rejects.toBeInstanceOf(StoryContentEmptyException);
      expect(complete).not.toHaveBeenCalled();
    });
  });

  describe('reads are owner-scoped', () => {
    it('getGraph throws when the owner has no graph for the story', async () => {
      const { service } = makeService({ repo: { findGraph: jest.fn().mockResolvedValue(null) } });
      await expect(service.getGraph('u1', 'nope')).rejects.toBeInstanceOf(StoryNotFoundException);
    });

    it('getAnalysis throws when the run is missing', async () => {
      const { service } = makeService({
        repo: { findAnalysis: jest.fn().mockResolvedValue(null) },
      });
      await expect(service.getAnalysis('u1', 'piece-1', 'missing')).rejects.toBeInstanceOf(
        StoryAnalysisNotFoundException,
      );
    });
  });

  // ── D4 — story_intelligence graph reads are entitlement-gated (docs/48 §5.2) ──────
  //
  // Every read here has no OTHER caller (confirmed by grep before this change), so the
  // gate lives inside the service method itself. `getGraph` is the one exception — it
  // is also `getGraphSnapshot`'s reuse seam for Recommendations and Ask My Book (both
  // confirmed free), so it deliberately does NOT gate itself; its controller action
  // asserts before calling in instead (see story-intelligence.controller.ts).
  describe('graph reads are entitlement-gated, except getGraph itself', () => {
    const READS: Array<[string, (service: StoryIntelligenceService) => Promise<unknown>]> = [
      ['getCharacterGraph', (s) => s.getCharacterGraph('u1', 'piece-1')],
      ['getTimeline', (s) => s.getTimeline('u1', 'piece-1')],
      ['listAnalyses', (s) => s.listAnalyses('u1', 'piece-1', undefined)],
      ['getAnalysis', (s) => s.getAnalysis('u1', 'piece-1', 'a1')],
      ['resetGraph', (s) => s.resetGraph('u1', 'piece-1')],
    ];

    it.each(READS)('%s asserts entitlement before touching the graph', async (_name, call) => {
      const denied = jest.fn().mockRejectedValue(new Error('ENTITLEMENT_DENIED'));
      const { service, repo } = makeService({ assertAllowed: denied });

      await expect(call(service)).rejects.toThrow('ENTITLEMENT_DENIED');
      expect(denied).toHaveBeenCalledWith('u1', 'story_intelligence');
      expect(repo.findGraph).not.toHaveBeenCalled();
    });

    it.each(READS)(
      '%s skips the check when payments are dark (mirrors checkQuota)',
      async (_name, call) => {
        const { service, assertAllowed, repo } = makeService({ paymentsEnabled: false });

        await call(service);

        expect(assertAllowed).not.toHaveBeenCalled();
        expect(repo.findGraph).toHaveBeenCalled();
      },
    );

    it('getGraph itself never asserts entitlement — the controller does, so getGraphSnapshot stays free for Recommendations/Ask My Book', async () => {
      const { service, assertAllowed } = makeService({});

      await service.getGraph('u1', 'piece-1');
      await service.getGraphSnapshot('u1', 'piece-1');

      expect(assertAllowed).not.toHaveBeenCalled();
    });
  });
});
