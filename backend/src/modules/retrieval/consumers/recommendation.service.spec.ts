import { RecommendationKind } from '@qalam/shared';

import type { AiFeatureService } from '../../ai';
import type { DiscoveryService } from '../../feed/discovery.service';
import type { TrendingService } from '../../feed/trending.service';
import type { SearchService } from '../../search';
import type { StoryGraphDto } from '../../story-intelligence/dto/story-response.dto';
import type { StoryIntelligenceService } from '../../story-intelligence/story-intelligence.service';
import type { RetrievalTelemetryService } from '../observability/retrieval-telemetry.service';
import { RecommendationService } from './recommendation.service';

const graph: StoryGraphDto = {
  storyId: 'piece-1',
  title: 'Novel',
  nodeCount: 1,
  edgeCount: 0,
  analysisCount: 1,
  lastAnalyzedAt: null,
  nodes: [
    {
      id: 'c1',
      type: 'character',
      name: 'Aria',
      aliases: [],
      summary: 'the hero',
      data: {},
      confidence: 80,
      mentionCount: 10,
      firstChapter: 'ch1',
      evidence: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  edges: [],
};

function makeService() {
  const assertEnabled = jest.fn().mockResolvedValue(undefined);
  const features = { assertEnabled } as unknown as AiFeatureService;
  const trending = {
    getFeed: jest.fn().mockResolvedValue({
      items: [{ id: 'p1', slug: 's1', title: 'Trend', subtitle: 'sub' }],
      meta: {},
    }),
  } as unknown as TrendingService;
  const discovery = {} as unknown as DiscoveryService;
  const search = {} as unknown as SearchService;
  const story = {
    getGraphSnapshot: jest.fn().mockResolvedValue(graph),
  } as unknown as StoryIntelligenceService;
  const telemetry = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as RetrievalTelemetryService;
  return {
    service: new RecommendationService(features, trending, discovery, search, story, telemetry),
    assertEnabled,
    trending,
    story,
  };
}

describe('RecommendationService', () => {
  it('gates the feature and reuses TrendingService for trending — every item explains itself', async () => {
    const { service, assertEnabled, trending } = makeService();
    const res = await service.recommend('u1', { kind: RecommendationKind.Trending });

    expect(assertEnabled).toHaveBeenCalled();
    expect(trending.getFeed).toHaveBeenCalled();
    expect(res.kind).toBe(RecommendationKind.Trending);
    expect(res.items[0]?.targetType).toBe('piece');
    expect(res.items[0]?.reason.length).toBeGreaterThan(0);
    expect(res.items[0]?.navigation).toEqual({ kind: 'piece', ref: 's1' });
  });

  it('derives related characters from the story graph, each with a reason + evidence', async () => {
    const { service, story } = makeService();
    const res = await service.recommend('u1', {
      kind: RecommendationKind.RelatedCharacters,
      storyId: 'piece-1',
    });

    expect(story.getGraphSnapshot).toHaveBeenCalledWith('u1', 'piece-1');
    expect(res.items[0]?.targetType).toBe('character');
    expect(res.items[0]?.title).toBe('Aria');
    expect(res.items[0]?.reason.length).toBeGreaterThan(0);
    expect(res.items[0]?.evidence.length).toBeGreaterThan(0);
  });

  it('returns an empty set gracefully for collections (no source yet)', async () => {
    const { service } = makeService();
    const res = await service.recommend('u1', { kind: RecommendationKind.Collections });
    expect(res.items).toEqual([]);
  });
});
