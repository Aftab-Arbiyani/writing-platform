import { FollowStatus } from '@qalam/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { ProfileResponse } from '@/types/profile';

import { followsApi } from '../api/follows.api';

/**
 * Optimistic follow / unfollow for a profile keyed by `username` (docs/12 §2.4–§2.5). The button
 * flips to Following (public) or Requested (private) instantly; the server response
 * (`accepted` vs `pending`) corrects the guess if we were wrong about privacy, and `onSettled`
 * reconciles from the source of truth. On error we roll back and let the caller toast.
 *
 * Follow/unfollow target the **user UUID** (`profile.id`); the cache entry is keyed by username —
 * the two are not interchangeable (docs/11 §10.3), so both are passed in.
 */
function patchRelation(
  client: ReturnType<typeof useQueryClient>,
  key: readonly unknown[],
  update: (prev: ProfileResponse) => ProfileResponse,
): ProfileResponse | undefined {
  const prev = client.getQueryData<ProfileResponse>(key);
  if (prev) client.setQueryData<ProfileResponse>(key, update(prev));
  return prev;
}

export function useFollow(username: string) {
  const client = useQueryClient();
  const key = qk.profiles.detail(username);

  const settle = () => {
    void client.invalidateQueries({ queryKey: key });
    void client.invalidateQueries({ queryKey: qk.feed.all }); // the "following" feed changed
  };

  const follow = useMutation({
    mutationFn: (userId: string) => followsApi.follow(userId),
    onMutate: async () => {
      await client.cancelQueries({ queryKey: key });
      // Optimistic: private target → a pending request; public → an immediate follow (+1 follower).
      const prev = patchRelation(client, key, (p) =>
        p.isPrivate
          ? { ...p, viewerRelation: { ...p.viewerRelation, hasPendingRequest: true } }
          : {
              ...p,
              viewerRelation: { ...p.viewerRelation, isFollowing: true },
              counts: { ...p.counts, followers: p.counts.followers + 1 },
            },
      );
      return { prev };
    },
    onSuccess: (result) => {
      // Correct the optimistic guess from the authoritative status.
      patchRelation(client, key, (p) => ({
        ...p,
        viewerRelation: {
          ...p.viewerRelation,
          isFollowing: result.status === FollowStatus.Accepted,
          hasPendingRequest: result.status === FollowStatus.Pending,
        },
      }));
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) client.setQueryData(key, ctx.prev);
    },
    onSettled: settle,
  });

  const unfollow = useMutation({
    mutationFn: (userId: string) => followsApi.unfollow(userId),
    onMutate: async () => {
      await client.cancelQueries({ queryKey: key });
      // Covers both "unfollow accepted" (−1 follower) and "cancel pending request".
      const prev = patchRelation(client, key, (p) => ({
        ...p,
        viewerRelation: { ...p.viewerRelation, isFollowing: false, hasPendingRequest: false },
        counts: {
          ...p.counts,
          followers: p.viewerRelation.isFollowing
            ? Math.max(0, p.counts.followers - 1)
            : p.counts.followers,
        },
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) client.setQueryData(key, ctx.prev);
    },
    onSettled: settle,
  });

  return { follow, unfollow };
}
