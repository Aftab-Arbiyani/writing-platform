import { RecommendationKind } from '@qalam/shared';

import type { DiscoveryService } from '../../feed/discovery.service';
import type { TrendingService } from '../../feed/trending.service';
import type { PiecesService } from '../../pieces/pieces.service';
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
  const trending = {
    getFeed: jest.fn().mockResolvedValue({
      items: [{ id: 'p1', slug: 's1', title: 'Trend', subtitle: 'sub' }],
      meta: {},
    }),
  } as unknown as TrendingService;
  const discovery = {} as unknown as DiscoveryService;
  const searchPieces = jest.fn().mockResolvedValue({
    items: [
      { id: 'seed', slug: 'seed-slug', title: 'The seed itself', subtitle: '' },
      { id: 'p2', slug: 's2', title: 'A neighbour', subtitle: 'about rain' },
    ],
    meta: {},
  });
  const search = { searchPieces } as unknown as SearchService;
  const story = {
    getGraphSnapshot: jest.fn().mockResolvedValue(graph),
  } as unknown as StoryIntelligenceService;
  const getById = jest.fn().mockResolvedValue({
    id: 'seed',
    title: 'Rain over the old city',
    tags: [
      { slug: 'rain', name: 'Rain' },
      { slug: 'city', name: 'City' },
    ],
  });
  const pieces = { getById } as unknown as PiecesService;
  const telemetry = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as RetrievalTelemetryService;
  return {
    service: new RecommendationService(trending, discovery, search, story, pieces, telemetry),
    trending,
    story,
    searchPieces,
    getById,
  };
}

describe('RecommendationService', () => {
  it('reuses TrendingService for trending — every item explains itself', async () => {
    const { service, trending } = makeService();
    const res = await service.recommend('u1', { kind: RecommendationKind.Trending });

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

  /**
   * The `pieceId` seed (W5, 48 §3.9 W5-2). Before this, a piece-seeded request fell through to
   * community trending, so "more like this" was "popular right now" wearing a recommendation's
   * clothes. These assert the three properties that make it a recommendation instead: it reads the
   * seed as the caller, it relates to the seed, and it does not contaminate the reader's history.
   */
  describe('related stories seeded by a piece', () => {
    it('derives terms from the seed piece read AS THE CALLER, and explains the relationship', async () => {
      const { service, getById, searchPieces } = makeService();
      const res = await service.recommend('u1', {
        kind: RecommendationKind.RelatedStories,
        pieceId: 'seed',
      });

      // As the caller — so the piece's own visibility rules decide, not the recommender.
      expect(getById).toHaveBeenCalledWith('seed', 'u1');
      expect(searchPieces).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'Rain City' }),
        { id: 'u1' },
        expect.anything(),
      );
      expect(res.items[0]?.reason).toContain('Rain');
      expect(res.items[0]?.influencedBy.map((e) => e.name)).toEqual(['Rain', 'City']);
      expect(res.items[0]?.influencedBy[0]?.relation).toBe('shared tag');
    });

    it('never recommends the seed piece back to itself', async () => {
      const { service } = makeService();
      const res = await service.recommend('u1', {
        kind: RecommendationKind.RelatedStories,
        pieceId: 'seed',
      });
      expect(res.items.map((i) => i.id)).toEqual(['p2']);
    });

    it('does not write machine-composed terms into search history (W5-5)', async () => {
      const { service, searchPieces } = makeService();
      await service.recommend('u1', { kind: RecommendationKind.RelatedStories, pieceId: 'seed' });
      expect(searchPieces).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        recordHistory: false,
      });
    });

    it('falls back to the title when the seed has no tags', async () => {
      const { service, getById, searchPieces } = makeService();
      getById.mockResolvedValueOnce({ id: 'seed', title: 'Rain over the old city', tags: [] });
      await service.recommend('u1', { kind: RecommendationKind.RelatedStories, pieceId: 'seed' });
      // Two-letter words are dropped — they match nothing useful in FTS.
      expect(searchPieces).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'Rain over the old city' }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('prefers the story graph when both seeds are given', async () => {
      const { service, story, getById } = makeService();
      await service.recommend('u1', {
        kind: RecommendationKind.RelatedStories,
        storyId: 'piece-1',
        pieceId: 'seed',
      });
      expect(story.getGraphSnapshot).toHaveBeenCalledWith('u1', 'piece-1');
      expect(getById).not.toHaveBeenCalled();
    });

    it('still answers community trending with no seed at all, and says so', async () => {
      const { service, trending } = makeService();
      const res = await service.recommend('u1', { kind: RecommendationKind.RelatedStories });
      expect(trending.getFeed).toHaveBeenCalled();
      expect(res.items[0]?.reason).toBe('Popular right now');
    });
  });
});
