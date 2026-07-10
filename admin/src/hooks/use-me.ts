import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';
import type { MeResponse } from '@/types/me';

/**
 * The signed-in operator's identity (`GET /me`). Shared (not in features/auth) so the app chrome can
 * show the account without a cross-feature import — mirrors the reader. Cached (identity is stable);
 * gated on an authenticated session so it never fires for an anonymous visitor. Role is NOT here
 * (it comes from the JWT via the auth store); this is name/handle/avatar only.
 */
export function useMe(): UseQueryResult<MeResponse, Error> {
  const isAuthed = useAuthStore((state) => state.status === 'authenticated');
  return useQuery<MeResponse, Error>({
    queryKey: qk.auth.me(),
    queryFn: ({ signal }) => api.get<MeResponse>('/me', { signal }).then((result) => result.data),
    enabled: isAuthed,
    staleTime: 60_000,
  });
}
