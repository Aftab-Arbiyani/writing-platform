import { getPage, patch, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';
import type { FollowRequest, UserSummary } from '@/types/profile';

/**
 * Follow-graph endpoints with a single consumer — the requests inbox and the followers/following
 * lists (docs/32 §10, docs/11 §10.3). The three id-types are NOT interchangeable: accept/reject
 * take the **follow-row UUID** (from the requests list); followers/following take the
 * **username** string. Lists are cursor-paginated (limit clamped ≤50 upstream).
 *
 * Follow/unfollow themselves are NOT here: two features need them (the profile header and the
 * reading view's author card), so they moved down to the app-level `hooks/use-follow` with their
 * optimistic cache patching (docs/26 §4).
 */
const MAX_LIMIT = 50;

export const followsApi = {
  listRequests: (
    cursor: string | undefined,
    signal?: AbortSignal,
  ): Promise<CursorPage<FollowRequest>> =>
    getPage<FollowRequest>(`/me/follow-requests${buildQueryString({ cursor, limit: 20 })}`, {
      signal,
    }),

  acceptRequest: (followId: string): Promise<{ accepted: true }> =>
    patch<{ accepted: true }>(`/follow-requests/${followId}/accept`),

  rejectRequest: (followId: string): Promise<{ rejected: true }> =>
    patch<{ rejected: true }>(`/follow-requests/${followId}/reject`),

  followers: (
    username: string,
    cursor: string | undefined,
    signal?: AbortSignal,
  ): Promise<CursorPage<UserSummary>> =>
    getPage<UserSummary>(
      `/users/${encodeURIComponent(username)}/followers${buildQueryString({ cursor, limit: MAX_LIMIT })}`,
      { signal },
    ),

  following: (
    username: string,
    cursor: string | undefined,
    signal?: AbortSignal,
  ): Promise<CursorPage<UserSummary>> =>
    getPage<UserSummary>(
      `/users/${encodeURIComponent(username)}/following${buildQueryString({ cursor, limit: MAX_LIMIT })}`,
      { signal },
    ),
};
