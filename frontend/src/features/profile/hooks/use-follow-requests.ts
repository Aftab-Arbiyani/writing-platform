import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { followsApi } from '../api/follows.api';

/**
 * Incoming pending follow requests (`GET /me/follow-requests`, cursor-infinite). Identity tier
 * (1 min). Each item's `id` is the follow-ROW UUID used by accept/reject (docs/11 §10.3).
 */
export function useFollowRequests() {
  return useInfiniteQuery({
    queryKey: qk.me.followRequests(),
    queryFn: ({ pageParam, signal }) => followsApi.listRequests(pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    staleTime: 60_000,
  });
}

/**
 * Accept / reject a follow request. Accepting adds the requester to MY followers, so both my
 * identity (`qk.auth.me`) and any cached profile detail, plus the "following" feed, are
 * invalidated (docs/12 §2.4). The requests list is always refreshed.
 */
export function useFollowRequestActions() {
  const client = useQueryClient();

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: qk.me.followRequests() });
    void client.invalidateQueries({ queryKey: qk.auth.me() });
    void client.invalidateQueries({ queryKey: qk.profiles.all });
    void client.invalidateQueries({ queryKey: qk.feed.all });
  };

  const accept = useMutation({
    mutationFn: (followId: string) => followsApi.acceptRequest(followId),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: (followId: string) => followsApi.rejectRequest(followId),
    onSuccess: invalidate,
  });

  return { accept, reject };
}
