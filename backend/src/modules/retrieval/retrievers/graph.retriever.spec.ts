import { RetrievalIntent, RetrievalQueryType, RetrievalSource } from '@qalam/shared';

import type { StoryGraphDto } from '../../story-intelligence/dto/story-response.dto';
import type { StoryIntelligenceService } from '../../story-intelligence/story-intelligence.service';
import type { RetrievalPlan, RetrievalRequest } from '../retrieval.types';
import { GraphRetriever } from './graph.retriever';

const graph: StoryGraphDto = {
  storyId: 'piece-1',
  title: 'My Novel',
  nodeCount: 2,
  edgeCount: 1,
  analysisCount: 1,
  lastAnalyzedAt: null,
  nodes: [
    {
      id: 'n1',
      type: 'character',
      name: 'Aria',
      aliases: ['the wanderer'],
      summary: 'A brave hero.',
      data: { role: 'protagonist' },
      confidence: 80,
      mentionCount: 12,
      firstChapter: 'ch1',
      evidence: [{ chapterRef: 'ch1', quote: 'Aria drew her blade.' }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'n2',
      type: 'location',
      name: 'Dark Forest',
      aliases: [],
      summary: 'A shadowed wood.',
      data: {},
      confidence: 60,
      mentionCount: 4,
      firstChapter: 'ch1',
      evidence: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  edges: [
    {
      id: 'e1',
      type: 'appears_in',
      sourceId: 'n1',
      targetId: 'n2',
      label: 'appears in',
      data: {},
      confidence: 70,
      evidence: [],
    },
  ],
};

function makeRetriever(snapshot: StoryGraphDto | Error): {
  retriever: GraphRetriever;
  getGraphSnapshot: jest.Mock;
} {
  const getGraphSnapshot = jest.fn();
  if (snapshot instanceof Error) getGraphSnapshot.mockRejectedValue(snapshot);
  else getGraphSnapshot.mockResolvedValue(snapshot);
  const story = { getGraphSnapshot } as unknown as StoryIntelligenceService;
  return { retriever: new GraphRetriever(story), getGraphSnapshot };
}

const plan: RetrievalPlan = {
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
};

const request: RetrievalRequest = {
  userId: 'u1',
  query: 'Aria',
  intent: RetrievalIntent.Search,
  storyId: 'piece-1',
  limit: 10,
};

describe('GraphRetriever', () => {
  it('returns nothing when there is no storyId (library scope)', async () => {
    const { retriever, getGraphSnapshot } = makeRetriever(graph);
    const out = await retriever.retrieve(plan, { ...request, storyId: undefined });
    expect(out).toEqual([]);
    expect(getGraphSnapshot).not.toHaveBeenCalled();
  });

  it('retrieves matching nodes, filtered by node type, with evidence + navigation + signals', async () => {
    const { retriever } = makeRetriever(graph);
    const out = await retriever.retrieve(plan, request);
    expect(out).toHaveLength(1); // only the character node (nodeTypes = ['character'])
    const aria = out[0]!;
    expect(aria.id).toBe('n1');
    expect(aria.source).toBe(RetrievalSource.KnowledgeGraph);
    expect(aria.evidence[0]?.quote).toBe('Aria drew her blade.');
    expect(aria.navigation).toEqual({ kind: 'graph_node', ref: 'n1', view: 'character' });
    expect(aria.signals?.confidence).toBeCloseTo(0.8); // 80 → 0.8
    expect(aria.related.map((r) => r.name)).toContain('Dark Forest');
  });

  it('propagates STORY_NOT_FOUND (owner/existence signal) rather than swallowing it', async () => {
    const err = Object.assign(new Error('nope'), { code: 'STORY_NOT_FOUND' });
    const { retriever } = makeRetriever(err);
    await expect(retriever.retrieve(plan, request)).rejects.toBe(err);
  });
});
