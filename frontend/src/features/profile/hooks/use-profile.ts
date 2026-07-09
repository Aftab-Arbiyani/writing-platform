import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { profilesApi } from '../api/profiles.api';

/**
 * A public writer profile by username (`GET /users/:username`, optional-auth). Identity tier
 * (1 min staleTime, docs/12 §2.2 — follower counts change at human speed). Disabled until a
 * username is resolved from the `@handle` route param. `USER_NOT_FOUND` (404) surfaces as an
 * error the page maps to a NotFound state (never leaks whether a private account exists).
 */
export function useProfile(username: string | null) {
  return useQuery({
    queryKey: qk.profiles.detail(username ?? ''),
    queryFn: ({ signal }) => profilesApi.getByUsername(username ?? '', signal),
    enabled: Boolean(username),
    staleTime: 60_000,
  });
}
