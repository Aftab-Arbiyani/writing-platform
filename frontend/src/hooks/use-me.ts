import { useQuery } from '@tanstack/react-query';

import { get } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';
import type { ProfileResponse } from '@/types/profile';

/**
 * The signed-in user's own profile (`GET /me`) — the single session-identity query
 * (docs/11 §4, docs/12 §2.1; guards read the same `qk.auth.me` key). App-level, not in a
 * feature: the user menu, the `/me` redirect, the profile page, and the settings prefill all
 * read it, and features must never import one another (docs/26 §4).
 *
 * Identity tier: 1 min staleTime (docs/12 §2.2). Disabled while the session is unknown/anonymous
 * so it never fires without a token.
 */
export function useMe() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: qk.auth.me(),
    queryFn: ({ signal }) => get<ProfileResponse>('/me', { signal }),
    enabled: status === 'authenticated',
    staleTime: 60_000,
  });
}
