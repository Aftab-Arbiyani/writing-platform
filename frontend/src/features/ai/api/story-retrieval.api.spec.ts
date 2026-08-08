import { AskScope, ExplorerView } from '@qalam/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as apiClient from '@/lib/api-client';

import { storyRetrievalApi } from './story-retrieval.api';

vi.mock('@/lib/api-client');

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);
const stream = vi.mocked(apiClient.stream);

/**
 * Request-shape pins for W9's two story-scoped AF4 routes.
 *
 * Same level as `features/search/api/retrieval.api.spec.ts` and for the same reason: the wire is
 * where this class of defect lives. `AskBookDto` runs through the global `forbidNonWhitelisted`
 * pipe, so an extra key is a 400 on the whole ask rather than a field that quietly does nothing —
 * the exact shape of W5-1 and W4-5.
 */
describe('storyRetrievalApi request shapes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue(undefined as never);
    post.mockResolvedValue(undefined as never);
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

  describe('POST /ai/ask/stream', () => {
    it('sends storyId, question and scope — and nothing it was not given', () => {
      storyRetrievalApi.askStream({
        storyId: 'piece-1',
        question: 'How does Aria change?',
        scope: AskScope.Character,
      });

      const body = stream.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(stream.mock.calls[0]?.[0]).toBe('/ai/ask/stream');
      expect(body).toEqual({
        storyId: 'piece-1',
        question: 'How does Aria change?',
        scope: 'character',
      });
      // `forbidNonWhitelisted` rejects anything the DTO does not declare — an undeclared key here
      // would 400 the whole ask, not be ignored.
      expect(Object.keys(body)).toEqual(['storyId', 'question', 'scope']);
    });

    it('forwards the abort signal, so Stop cancels generation server-side', () => {
      const controller = new AbortController();
      storyRetrievalApi.askStream(
        { storyId: 'piece-1', question: 'Who betrayed the queen?' },
        { signal: controller.signal },
      );
      expect(stream.mock.calls[0]?.[2]).toEqual({ signal: controller.signal });
    });
  });

  it('buffers through POST /ai/ask when asked to', async () => {
    await storyRetrievalApi.ask({ storyId: 'piece-1', question: 'Why?' });
    expect(post).toHaveBeenCalledWith(
      '/ai/ask',
      { storyId: 'piece-1', question: 'Why?' },
      { signal: undefined },
    );
  });
});
