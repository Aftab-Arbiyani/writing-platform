import type { ShareChannel } from '@qalam/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { readingApi } from '../api/reading.api';
import type { PieceEngagement } from '../types/reading.types';

/**
 * The reader's engagement actions (W1, docs/45 §4.1) — the web analog of mobile's
 * `engagement_controller`: like, bookmark and share, all **optimistic** with rollback
 * (docs/12 §2.4–§2.5). The count flips under the reader's finger and reconciles from the
 * server's authoritative total on settle.
 *
 * Claps and responses stay read-only counts in W1. Claps are a 1..50 accumulating gesture with
 * its own interaction model, and responses need the comment surface — neither is "the reader can
 * act on what they just read", which is what this epic owes.
 */
function patch(
  client: ReturnType<typeof useQueryClient>,
  key: readonly unknown[],
  update: (prev: PieceEngagement) => PieceEngagement,
): PieceEngagement | undefined {
  const prev = client.getQueryData<PieceEngagement>(key);
  if (prev) client.setQueryData<PieceEngagement>(key, update(prev));
  return prev;
}

const clamp = (value: number): number => (value < 0 ? 0 : value);

export function useEngagementActions(pieceId: string) {
  const client = useQueryClient();
  const key = qk.pieces.engagement(pieceId);

  /** Both like directions share the same optimistic patch and the same rollback. */
  const likeToggle = (liked: boolean) => ({
    onMutate: async () => {
      await client.cancelQueries({ queryKey: key });
      const prev = patch(client, key, (e) => ({
        stats: { ...e.stats, likes: clamp(e.stats.likes + (liked ? 1 : -1)) },
        viewer: { ...e.viewer, hasLiked: liked },
      }));
      return { prev };
    },
    onError: (_err: unknown, _vars: unknown, ctx: { prev?: PieceEngagement } | undefined) => {
      if (ctx?.prev) client.setQueryData(key, ctx.prev);
    },
  });

  const like = useMutation({
    mutationFn: () => readingApi.like(pieceId),
    ...likeToggle(true),
    // The server returns the true total — adopt it rather than trusting our +1 (concurrent
    // readers move this number while the page is open).
    onSuccess: (result) => {
      patch(client, key, (e) => ({
        stats: { ...e.stats, likes: result.totalLikes },
        viewer: { ...e.viewer, hasLiked: result.liked },
      }));
    },
  });

  const unlike = useMutation({
    mutationFn: () => readingApi.unlike(pieceId),
    ...likeToggle(false),
  });

  const bookmarkToggle = (bookmarked: boolean) => ({
    onMutate: async () => {
      await client.cancelQueries({ queryKey: key });
      const prev = patch(client, key, (e) => ({
        stats: { ...e.stats, bookmarks: clamp(e.stats.bookmarks + (bookmarked ? 1 : -1)) },
        viewer: { ...e.viewer, hasBookmarked: bookmarked },
      }));
      return { prev };
    },
    onError: (_err: unknown, _vars: unknown, ctx: { prev?: PieceEngagement } | undefined) => {
      if (ctx?.prev) client.setQueryData(key, ctx.prev);
    },
    // No cache to invalidate beyond this key: `GET /me/bookmarks` has no web surface yet, so
    // there is no bookmarks list to go stale. When that surface lands it invalidates here.
  });

  const bookmark = useMutation({
    mutationFn: () => readingApi.bookmark(pieceId),
    ...bookmarkToggle(true),
  });

  const unbookmark = useMutation({
    mutationFn: () => readingApi.unbookmark(pieceId),
    ...bookmarkToggle(false),
  });

  /**
   * Recording a share is fire-and-forget from the reader's point of view — the link is already
   * on their clipboard by the time this resolves, so a failure must never surface as an error.
   * It is still optimistic so the count moves immediately.
   */
  const share = useMutation({
    mutationFn: (channel: ShareChannel) => readingApi.share(pieceId, channel),
    onMutate: async () => {
      await client.cancelQueries({ queryKey: key });
      const prev = patch(client, key, (e) => ({
        ...e,
        stats: { ...e.stats, shares: e.stats.shares + 1 },
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) client.setQueryData(key, ctx.prev);
    },
  });

  return { like, unlike, bookmark, unbookmark, share };
}
