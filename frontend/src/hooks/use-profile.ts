import { useQuery } from '@tanstack/react-query';

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
