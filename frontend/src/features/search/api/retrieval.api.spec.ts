import { RecommendationKind, RetrievalQueryType } from '@qalam/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as apiClient from '@/lib/api-client';

import { retrievalApi } from './retrieval.api';

vi.mock('@/lib/api-client');

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);
const del = vi.mocked(apiClient.del);

/**
 * Request-shape pins for the AF4 retrieval routes (W5).
 *
 * These assert the **wire**, not the client abstraction: the exact path, the exact body keys, and
 * the absence of keys the DTOs do not declare. That is the only level at which the defect this row
 * opened with is visible — `@qalam/api-types` declared a nested `filters` object that
 * `SemanticSearchDto` has never accepted, and because the global pipe runs `forbidNonWhitelisted`,
 * a client built on that type gets 400 on every filtered search rather than filters that quietly do
 * nothing (48 §3.9, W5-1). A test that only checked "search resolves" would have shipped it.
 */
describe('retrievalApi request shapes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ suggestions: [] } as never);
    post.mockResolvedValue(undefined as never);
    del.mockResolvedValue(undefined as never);
  });

  describe('POST /ai/search', () => {
    it('sends the query and nothing it was not given', async () => {
      await retrievalApi.search({ query: 'rain over the city' });
      expect(post).toHaveBeenCalledWith(
        '/ai/search',
        { query: 'rain over the city' },
        { signal: undefined },
      );
    });

    it('sends filters FLAT, with tags as a comma-separated string (W5-1)', async () => {
      await retrievalApi.search({
        query: 'rain',
        language: 'ur',
        genre: 'ghazal',
        tags: 'rain,city',
        queryType: RetrievalQueryType.NaturalLanguage,
        limit: 20,
        synthesize: true,
      });

      const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
      // The shape the DTO declares — flat keys, `tags` a string.
      expect(body).toEqual({
        query: 'rain',
        language: 'ur',
        genre: 'ghazal',
        tags: 'rain,city',
        queryType: 'natural_language',
        limit: 20,
        synthesize: true,
      });
      // The shape api-types used to declare, and the reason this file exists.
      expect(body).not.toHaveProperty('filters');
      expect(Array.isArray(body.tags)).toBe(false);
    });
  });

  describe('GET /ai/search/suggestions', () => {
    it('passes the prefix as `q` and unwraps `suggestions`', async () => {
      get.mockResolvedValueOnce({ suggestions: ['Rain', 'Rainfall'] } as never);
      await expect(retrievalApi.suggestions('rai')).resolves.toEqual(['Rain', 'Rainfall']);
      expect(get).toHaveBeenCalledWith('/ai/search/suggestions?q=rai', { signal: undefined });
    });

    it('omits storyId entirely when there is none, rather than sending an empty one', async () => {
      await retrievalApi.suggestions('rai', undefined);
      expect(get.mock.calls[0]?.[0]).toBe('/ai/search/suggestions?q=rai');
    });

    it('scopes to a story when given one', async () => {
      await retrievalApi.suggestions('rai', 'piece-1');
      expect(get.mock.calls[0]?.[0]).toBe('/ai/search/suggestions?q=rai&storyId=piece-1');
    });
  });

  describe('saved searches', () => {
    it('lists from the collection path', async () => {
      get.mockResolvedValueOnce([] as never);
      await retrievalApi.savedSearches();
      expect(get).toHaveBeenCalledWith('/ai/search/saved', { signal: undefined });
    });

    it('saves name + query (queryType/storyId only when set)', async () => {
      await retrievalApi.saveSearch({ name: 'Rainy ghazals', query: 'rain' });
      expect(post).toHaveBeenCalledWith('/ai/search/saved', {
        name: 'Rainy ghazals',
        query: 'rain',
      });
    });

    it('encodes the id into the delete path', async () => {
      await retrievalApi.deleteSavedSearch('a/../b');
      expect(del).toHaveBeenCalledWith('/ai/search/saved/a%2F..%2Fb');
    });
  });

  describe('GET /ai/recommendations', () => {
    it('always sends the required kind', async () => {
      get.mockResolvedValueOnce({ kind: 'trending', items: [], meta: {} } as never);
      await retrievalApi.recommendations({ kind: RecommendationKind.Trending });
      expect(get).toHaveBeenCalledWith('/ai/recommendations?kind=trending', { signal: undefined });
    });

    it('sends pieceId for a piece-seeded surface — the reader "more like this" (W5-2)', async () => {
      get.mockResolvedValueOnce({ kind: 'related_stories', items: [], meta: {} } as never);
      await retrievalApi.recommendations({
        kind: RecommendationKind.RelatedStories,
        pieceId: 'piece-9',
        limit: 4,
      });
      expect(get.mock.calls[0]?.[0]).toBe(
        '/ai/recommendations?kind=related_stories&pieceId=piece-9&limit=4',
      );
    });

    it('omits absent seeds rather than sending blanks', async () => {
      get.mockResolvedValueOnce({ kind: 'feed', items: [], meta: {} } as never);
      await retrievalApi.recommendations({ kind: RecommendationKind.Feed });
      expect(get.mock.calls[0]?.[0]).not.toContain('storyId');
      expect(get.mock.calls[0]?.[0]).not.toContain('pieceId');
    });
  });
});
