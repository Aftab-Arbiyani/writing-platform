import { del, getPage, patch, post, type CursorPage } from '@/lib/api-client';
import { buildQueryString } from '@/lib/http';
import type { FollowActionResult, FollowRequest, UserSummary } from '@/types/profile';

/**
 * Follow-graph endpoints (docs/32 §10, docs/11 §10.3). The three id-types are NOT
 * interchangeable: follow/unfollow take the **target user UUID** (`:id`); accept/reject take the
 * **follow-row UUID** (from the requests list); followers/following take the **username** string.
 * Lists are cursor-paginated (limit clamped ≤50 upstream); unfollow is 204 → void.
 */
const MAX_LIMIT = 50;

export const followsApi = {
  /** Follow → `accepted` (public target) or `pending` (private → request). */
  follow: (userId: string): Promise<FollowActionResult> =>
    post<FollowActionResult>(`/users/${userId}/follow`),

  /** Unfollow OR cancel a pending request — idempotent (204). */
  unfollow: (userId: string): Promise<void> => del(`/users/${userId}/follow`),

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
