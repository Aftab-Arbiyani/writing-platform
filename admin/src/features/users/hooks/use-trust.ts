import { PERMISSIONS } from '@qalam/shared';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { usePermissions } from '@/hooks/use-permissions';
import { qk } from '@/lib/query-keys';

import { trustApi } from '../api/trust.api';
import type {
  AdminRestriction,
  AdminStrike,
  AdminTrustSummary,
  ApplyRestrictionPayload,
  IssueStrikePayload,
} from '../types/trust.types';

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

/**
 * `GET /admin/users/:id/strikes` — active AND historical (B9, closing A2-2).
 *
 * The third read, and the one that turned the strike form's escalation figure from a projection
 * into a fact: until this route existed nothing could read a strike back, so the client could
 * only state what a strike WOULD add and never what the account already carries.
 */
export function useTrustStrikes(
  userId: string,
  enabled = true,
): UseQueryResult<AdminStrike[], Error> {
  const { can } = usePermissions();
  return useQuery<AdminStrike[], Error>({
    queryKey: qk.trust.strikes(userId),
    queryFn: ({ signal }) => trustApi.strikes(userId, signal),
    enabled: userId !== '' && enabled && can(PERMISSIONS.TrustView),
    staleTime: TRUST_STALE,
  });
}

// ── Mutations (`trust.manage`) ──────────────────────────────────────────────────

/**
 * Every trust mutation invalidates the WHOLE trust namespace, never one key.
 *
 * The standing and the restriction list are separate reads and both move on any of the three
 * writes — including in ways that are not obvious: issuing a strike can create a restriction all by
 * itself (`maybeEscalate`), and lifting a restriction changes the standing's derived status even
 * though it targets a restriction row. Invalidating both is the only version of this that is
 * always right.
 *
 * The service also invalidates the Policy Engine's decision cache server-side
 * (`engine.invalidateUser`), which is a different cache from this one. Nothing here claims anything
 * about how fast that propagates to the user's own app — this row did not verify it.
 */
function useTrustInvalidation(): () => void {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.trust.all });
  };
}

/** `POST /admin/users/:id/strikes` — issue a strike. May auto-apply a restriction server-side. */
export function useIssueStrike(): UseMutationResult<
  AdminStrike,
  Error,
  { userId: string; payload: IssueStrikePayload }
> {
  const invalidate = useTrustInvalidation();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: IssueStrikePayload }) =>
      trustApi.issueStrike(userId, payload),
    onSuccess: invalidate,
  });
}

/** `POST /admin/users/:id/restrictions` — apply a restriction. */
export function useApplyRestriction(): UseMutationResult<
  AdminRestriction,
  Error,
  { userId: string; payload: ApplyRestrictionPayload }
> {
  const invalidate = useTrustInvalidation();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: ApplyRestrictionPayload }) =>
      trustApi.applyRestriction(userId, payload),
    onSuccess: invalidate,
  });
}

/**
 * `DELETE /admin/restrictions/:restrictionId` — lift one restriction.
 *
 * **Keyed by the RESTRICTION id.** Every other route in this file takes a user id, and both are
 * UUIDs, so the variable is named `restrictionId` and typed as its own object property rather than
 * a bare string a caller could fill from the wrong variable.
 */
export function useLiftRestriction(): UseMutationResult<
  AdminRestriction,
  Error,
  { restrictionId: string }
> {
  const invalidate = useTrustInvalidation();
  return useMutation({
    mutationFn: ({ restrictionId }: { restrictionId: string }) =>
      trustApi.liftRestriction(restrictionId),
    onSuccess: invalidate,
  });
}

/**
 * `DELETE /admin/strikes/:strikeId` — revoke one strike (B9, closing A2-2).
 *
 * **Keyed by the STRIKE's id**, on the same reasoning as the lift above.
 *
 * This is the only mutation on this surface that lowers the active strike weight, and the whole
 * namespace has to be invalidated because it moves all three reads at once: the strike's own row,
 * the standing's weight and score, and — via the score — the derived status. Lifting a restriction
 * does NOT lower the weight; the two remedies are deliberately distinct, and the components say so.
 */
export function useRevokeStrike(): UseMutationResult<AdminStrike, Error, { strikeId: string }> {
  const invalidate = useTrustInvalidation();
  return useMutation({
    mutationFn: ({ strikeId }: { strikeId: string }) => trustApi.revokeStrike(strikeId),
    onSuccess: invalidate,
  });
}
