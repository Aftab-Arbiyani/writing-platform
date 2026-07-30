import { Visibility } from '@qalam/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as apiClient from '@/lib/api-client';

import { publishingApi } from './publishing.api';

vi.mock('@/lib/api-client');

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);
const patch = vi.mocked(apiClient.patch);

/**
 * Request-shape pins for the publishing routes (AF6 W3c).
 *
 * Every assertion here corresponds to a defect the mobile client shipped and paid for
 * (`qalam-mobile/docs/56` §2.2). They are written as "this exact call, and nothing else" rather than
 * "it did not throw", because all four defects were **silent**: the server either discarded a body
 * it never declared, or rejected one key while the client reported a generic failure.
 *
 * If someone later "tidies" one of these calls by passing the obvious-looking body, these fail.
 */
describe('publishingApi request shapes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue(undefined as never);
    post.mockResolvedValue(undefined as never);
    patch.mockResolvedValue(undefined as never);
  });

  describe('handlers that declare no @Body() must be sent none (P-8)', () => {
    it('publish posts no body', async () => {
      await publishingApi.publish('story-1');
      expect(post).toHaveBeenCalledWith('/stories/story-1/publish');
    });

    it('unpublish posts no body', async () => {
      await publishingApi.unpublish('story-1');
      expect(post).toHaveBeenCalledWith('/stories/story-1/unpublish');
    });

    it('requestReview posts no body — a reviewerId would be discarded', async () => {
      await publishingApi.requestReview('story-1');
      expect(post).toHaveBeenCalledWith('/stories/story-1/review');
    });

    it('createSnapshot posts no body — the reason is the server’s, and there is no label', async () => {
      await publishingApi.createSnapshot('story-1');
      expect(post).toHaveBeenCalledWith('/stories/story-1/snapshots');
    });
  });

  describe('bodies the DTOs actually declare', () => {
    it('schedule sends scheduledAt, not scheduledFor, and nothing else (P-2)', async () => {
      const when = '2026-09-01T09:00:00.000Z';
      await publishingApi.schedule('story-1', when);

      expect(post).toHaveBeenCalledWith('/stories/story-1/schedule', { scheduledAt: when });
      const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(Object.keys(body)).toEqual(['scheduledAt']);
      // `visibility` on this route is what made every mobile schedule a 400 under
      // forbidNonWhitelisted, on top of the missing required key.
      expect(body).not.toHaveProperty('visibility');
    });

    it('changeVisibility PATCHes {visibility} (P-3 — and there is no `followers` value)', async () => {
      await publishingApi.changeVisibility('story-1', Visibility.Unlisted);
      expect(patch).toHaveBeenCalledWith('/stories/story-1/visibility', {
        visibility: 'unlisted',
      });
    });

    it('requestChanges sends `notes`, plural (P-5)', async () => {
      await publishingApi.requestChanges('story-1', 'tighten the ending');
      expect(post).toHaveBeenCalledWith('/stories/story-1/review/changes', {
        notes: 'tighten the ending',
      });
    });

    it('requestChanges with no note sends no body at all', async () => {
      await publishingApi.requestChanges('story-1');
      expect(post).toHaveBeenCalledWith('/stories/story-1/review/changes', undefined);
    });
  });

  describe('paths', () => {
    it('revert addresses the story AND the snapshot', async () => {
      await publishingApi.revert('story-1', 'snap-7');
      expect(post).toHaveBeenCalledWith('/stories/story-1/snapshots/snap-7/revert');
    });

    it('a single snapshot is addressed by the snapshot id, not the story', async () => {
      await publishingApi.snapshot('snap-7');
      expect(get).toHaveBeenCalledWith('/snapshots/snap-7', { signal: undefined });
    });

    it('encodes ids into paths', async () => {
      await publishingApi.publish('story/../1');
      expect(post).toHaveBeenCalledWith('/stories/story%2F..%2F1/publish');
    });
  });
});
