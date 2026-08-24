import { ExplorerView } from '@qalam/shared';

import type { StoryGraphDto } from '../../story-intelligence/dto/story-response.dto';
import { StoryIntelligenceService } from '../../story-intelligence/story-intelligence.service';
import { StoryExplorerService } from './story-explorer.service';

/**
 * D4 (docs/48 §5.2, decided 2026-08-21) — `story_intelligence` is now entitlement-gated.
 * `explore()` asserts BEFORE reading the graph, via `StoryIntelligenceService
 * .assertGraphReadEntitled` — not a second, independent check, so its own denial/
 * dark-launch behaviour (tested in `story-intelligence.service.spec.ts`) is exercised
 * here only at the call-site level: does `explore()` call it, and does a denial stop
 * the graph from ever being read.
 */
function graphFixture(): StoryGraphDto {
  return {
    storyId: 'piece-1',
    title: null,
    nodeCount: 1,
    edgeCount: 0,
    analysisCount: 1,
    lastAnalyzedAt: '2026-01-01T00:00:00.000Z',
    nodes: [
      {
        id: 'c1',
        type: 'character',
        name: 'Aria',
        aliases: [],
        summary: 'the hero',
        data: {},
        confidence: 0.9,
        mentionCount: 3,
        firstChapter: null,
        evidence: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    edges: [],
  };
}

function makeExplorer(overrides: {
  assertGraphReadEntitled?: jest.Mock;
  getGraphSnapshot?: jest.Mock;
}): {
  explorer: StoryExplorerService;
  assertGraphReadEntitled: jest.Mock;
  getGraphSnapshot: jest.Mock;
} {
  const assertGraphReadEntitled =
    overrides.assertGraphReadEntitled ?? jest.fn().mockResolvedValue(undefined);
  const getGraphSnapshot =
    overrides.getGraphSnapshot ?? jest.fn().mockResolvedValue(graphFixture());
  const story = {
    assertGraphReadEntitled,
    getGraphSnapshot,
  } as unknown as StoryIntelligenceService;
  const explorer = new StoryExplorerService(story);
  return { explorer, assertGraphReadEntitled, getGraphSnapshot };
}

describe('StoryExplorerService', () => {
  it('asserts entitlement before reading the graph', async () => {
    const { explorer, assertGraphReadEntitled, getGraphSnapshot } = makeExplorer({});

    await explorer.explore('u1', 'piece-1', ExplorerView.Characters);

    expect(assertGraphReadEntitled).toHaveBeenCalledWith('u1');
    expect(getGraphSnapshot).toHaveBeenCalledWith('u1', 'piece-1');
    const entitledOrder = assertGraphReadEntitled.mock.invocationCallOrder[0];
    const readOrder = getGraphSnapshot.mock.invocationCallOrder[0];
    expect(entitledOrder).toBeLessThan(readOrder as number);
  });

  it('propagates a denial and never reads the graph', async () => {
    const denied = jest.fn().mockRejectedValue(new Error('ENTITLEMENT_DENIED'));
    const { explorer, getGraphSnapshot } = makeExplorer({ assertGraphReadEntitled: denied });

    await expect(explorer.explore('u1', 'piece-1', ExplorerView.Characters)).rejects.toThrow(
      'ENTITLEMENT_DENIED',
    );
    expect(getGraphSnapshot).not.toHaveBeenCalled();
  });

  it('still projects the requested view when entitled', async () => {
    const { explorer } = makeExplorer({});

    const result = await explorer.explore('u1', 'piece-1', ExplorerView.Characters);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]?.name).toBe('Aria');
  });
});
