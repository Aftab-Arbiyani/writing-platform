import { PERMISSIONS } from '@qalam/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { trustApi } from '../api/trust.api';
import type { AdminRestriction, AdminTrustSummary } from '../types/trust.types';

/**
 * The two Trust reads (AF6, row A2) — both gated on `trust.view`.
 *
 * **The standing and the restriction history are separate requests on purpose.** They mean
 * different things: `TrustSummaryDto.restrictions` carries the ACTIVE rows only, while
 * `GET users/:id/restrictions` returns active AND historical. Merging them would lose the
 * distinction the second read exists to show, so both are fetched and both are invalidated after
 * any mutation.
 *
 * `enabled` gates on the grant as well as the id, so a viewer the router let through but who lacks
 * `trust.view` never fires a request that would 403.
 */
const TRUST_STALE = 30_000;

/** `GET /admin/users/:id/trust`. `userId` empty → disabled (the /trust page starts with no account). */
export function useTrustSummary(
  userId: string,
  enabled = true,
): UseQueryResult<AdminTrustSummary, Error> {
  const { can } = usePermissions();
  return useQuery<AdminTrustSummary, Error>({
    queryKey: qk.trust.summary(userId),
    queryFn: ({ signal }) => trustApi.summary(userId, signal),
    enabled: userId !== '' && enabled && can(PERMISSIONS.TrustView),
    staleTime: TRUST_STALE,
  });
}

/** `GET /admin/users/:id/restrictions` — active AND historical. */
export function useTrustRestrictions(
  userId: string,
  enabled = true,
): UseQueryResult<AdminRestriction[], Error> {
  const { can } = usePermissions();
  return useQuery<AdminRestriction[], Error>({
    queryKey: qk.trust.restrictions(userId),
    queryFn: ({ signal }) => trustApi.restrictions(userId, signal),
    enabled: userId !== '' && enabled && can(PERMISSIONS.TrustView),
    staleTime: TRUST_STALE,
  });
}
