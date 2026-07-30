import { useInfiniteQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { followsApi } from '../api/follows.api';

/**
 * A writer's followers / following (`GET /users/:username/{followers,following}`, cursor-infinite;
 * respects privacy — a private account's lists 403 for non-followers). Identity tier (1 min).
 * `enabled` gated so the query never fires before a username resolves or while a dialog is closed.
 */
export function useFollowers(username: string | null, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.profiles.followers(username ?? ''),
    queryFn: ({ pageParam, signal }) => followsApi.followers(username ?? '', pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    enabled: Boolean(username) && enabled,
    staleTime: 60_000,
  });
}

export function useFollowing(username: string | null, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.profiles.following(username ?? ''),
    queryFn: ({ pageParam, signal }) => followsApi.following(username ?? '', pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    enabled: Boolean(username) && enabled,
    staleTime: 60_000,
  });
}
