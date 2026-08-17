import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';

import { get } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { ProfileResponse } from '@/types/profile';

/**
 * A public writer profile by username (`GET /users/:username`, optional-auth). Identity tier
 * (1 min staleTime, docs/12 §2.2 — follower counts change at human speed). Disabled until a
 * username is resolved. `USER_NOT_FOUND` (404) surfaces as an error the caller maps to a
 * NotFound state (never leaks whether a private account exists).
 *
 * App-level, not in a feature (docs/26 §4, the `use-me` precedent): the profile page **and** the
 * reading view's author card (W1, docs/45 §4.1) both read it, and features must never import one
 * another. Both share the `qk.profiles.detail` key, so a follow performed on either surface is
 * immediately reflected on the other.
 */
export function useProfile(username: string | null) {
  return useQuery({
    queryKey: qk.profiles.detail(username ?? ''),
    queryFn: ({ signal }) =>
      get<ProfileResponse>(`/users/${encodeURIComponent(username ?? '')}`, { signal }),
    enabled: Boolean(username),
    staleTime: 60_000,
  });
}

/**
 * The same public profile by user **id** (`GET /users/by-id/:id`, optional-auth — B3, docs/45 §4).
 *
 * Why it exists: collaboration, retrieval and publishing DTOs carry ids only, so every surface that
 * names a person from one of them (comment author, reviewer, snapshot author, history actor, blocked
 * person, presence entry) had nothing to resolve *from* and showed a truncated UUID.
 *
 * Cost: TanStack dedups by query key, so a view costs one request per DISTINCT user, not per row —
 * a 20-comment thread between 3 people is 3 requests, not 20. Identity tier staleTime (1 min) as
 * the username hook, so re-renders and sibling surfaces reuse the same entry.
 *
 * On success it seeds `qk.profiles.detail(username)`, so a profile page or author card opened
 * afterwards is a cache hit — the two lookup keys share one cached profile rather than racing.
 */
export function useProfileById(userId: string | null) {
  const queryClient = useQueryClient();

  return useQuery(profileByIdQueryOptions(userId, queryClient));
}

/**
 * The same lookup as an options object, for a caller that must resolve **several** ids at once and
 * therefore cannot call a hook per id (`useQueries` — P-2's mention typeahead resolves a whole story
 * roster). Extracted rather than reimplemented so both callers share `qk.profiles.byId`: a name
 * already resolved for a comment author costs the typeahead nothing.
 */
export function profileByIdQueryOptions(userId: string | null, queryClient: QueryClient) {
  return {
    queryKey: qk.profiles.byId(userId ?? ''),
    queryFn: async ({ signal }: { signal?: AbortSignal }) => {
      const profile = await get<ProfileResponse>(
        `/users/by-id/${encodeURIComponent(userId ?? '')}`,
        { signal },
      );
      // A restricted (teaser) response is still a real profile — seeding it is correct; the
      // username route would have returned exactly the same body for the same viewer.
      if (profile.username) {
        queryClient.setQueryData(qk.profiles.detail(profile.username), profile);
      }
      return profile;
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
    // A deleted account 404s. Retrying cannot change that, and the caller has an honest fallback.
    retry: false,
  };
}
