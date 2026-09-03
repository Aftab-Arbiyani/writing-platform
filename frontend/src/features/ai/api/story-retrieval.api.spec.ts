import { ExplorerView } from '@qalam/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as apiClient from '@/lib/api-client';

import { storyRetrievalApi } from './story-retrieval.api';

vi.mock('@/lib/api-client');

const get = vi.mocked(apiClient.get);
const stream = vi.mocked(apiClient.stream);

/**
 * Request-shape pins for Story Map's routes.
 *
 * Same level as `features/search/api/retrieval.api.spec.ts` and for the same reason: the wire is
 * where this class of defect lives. `MapStoryDto` runs through the global `forbidNonWhitelisted`
 * pipe, so an extra key is a 400 on the whole run rather than a field that quietly does nothing —
 * the exact shape of W5-1 and W4-5.
 *
 * D5 replaced the Ask My Book pins here with the map trigger. Both `/ai/ask` routes are gone.
 */
describe('storyRetrievalApi request shapes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue(undefined as never);
  });

  describe('GET /ai/explorer/:storyId/:view', () => {
    it('puts the story and the view in the path, in that order', async () => {
      await storyRetrievalApi.explore('piece-1', ExplorerView.Characters);
      expect(get).toHaveBeenCalledWith('/ai/explorer/piece-1/characters', { signal: undefined });
    });

    it('encodes the story id rather than letting it walk the path', async () => {
      await storyRetrievalApi.explore('a/../b', ExplorerView.Map);
      expect(get.mock.calls[0]?.[0]).toBe('/ai/explorer/a%2F..%2Fb/map');
    });

    it('reaches all eight views under their wire values', async () => {
      for (const view of Object.values(ExplorerView)) {
        await storyRetrievalApi.explore('piece-1', view);
      }
      expect(get.mock.calls.map((call) => call[0])).toEqual([
        '/ai/explorer/piece-1/characters',
        '/ai/explorer/piece-1/relationships',
        '/ai/explorer/piece-1/timeline',
        '/ai/explorer/piece-1/locations',
        '/ai/explorer/piece-1/events',
        '/ai/explorer/piece-1/objects',
        '/ai/explorer/piece-1/concepts',
        '/ai/explorer/piece-1/map',
      ]);
    });
  });

  describe('POST /story-intelligence/:storyId/map/stream', () => {
    it('sends the content and the title — and nothing it was not given', () => {
      storyRetrievalApi.mapStory('piece-1', {
        content: 'The rain fell over the old city.',
        storyTitle: 'Barish',
      });

      expect(stream.mock.calls[0]?.[0]).toBe('/story-intelligence/piece-1/map/stream');
      const body = stream.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(body).toEqual({
        content: 'The rain fell over the old city.',
        storyTitle: 'Barish',
      });
      // `forbidNonWhitelisted` rejects anything `MapStoryDto` does not declare — an undeclared key
      // here would 400 the whole run, not be ignored.
      expect(Object.keys(body)).toEqual(['content', 'storyTitle']);
    });

    it('omits the title rather than sending an undefined one', () => {
      storyRetrievalApi.mapStory('piece-1', { content: 'The rain fell.' });

      expect(stream.mock.calls[0]?.[1]).toEqual({ content: 'The rain fell.' });
    });

    it('encodes the story id into the path', () => {
      storyRetrievalApi.mapStory('a/b', { content: 'x' });

      expect(stream.mock.calls[0]?.[0]).toBe('/story-intelligence/a%2Fb/map/stream');
    });

    it('forwards the abort signal, so Stop cancels the run server-side', () => {
      const controller = new AbortController();
      storyRetrievalApi.mapStory('piece-1', { content: 'x' }, { signal: controller.signal });

      // The server watches the request close and stops between analyses, so a writer who navigates
      // away is not charged for the ones they will never see.
      expect(stream.mock.calls[0]?.[2]).toEqual({ signal: controller.signal });
    });
  });
});
