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

import { monetizationApi } from '../api/monetization.api';
import type {
  AdminEntitlementOverride,
  AdminMonetizationConfig,
  AdminMonetizationConfigPatch,
  AdminPlanCatalogue,
  GrantOverridePayload,
} from '../types/monetization.types';

/**
 * Data hooks for the monetization admin surface (A1).
 *
 * Every read is gated on `billing.manage` via `enabled`, so a viewer the router let through by role
 * but who lacks the grant never fires a request that would 403. Mutations invalidate the whole
 * `monetization` namespace rather than surgically patching the cache: these are low-frequency
 * operator actions where a correct refetch is worth more than a saved round trip, and a config patch
 * can move a value the plan screen renders.
 */
function useBillingManage(): boolean {
  const { can } = usePermissions();
  return can(PERMISSIONS.BillingManage);
}

export function usePlans(): UseQueryResult<AdminPlanCatalogue> {
  const enabled = useBillingManage();
  return useQuery({
    queryKey: qk.monetization.plans(),
    queryFn: ({ signal }) => monetizationApi.getPlans(signal),
    enabled,
    // The catalogue is an admin-edited setting, not live telemetry — it changes rarely, and a stale
    // read here would be a stale read of a *decision*, so keep it short rather than long.
    staleTime: 60_000,
  });
}

export function useMonetizationConfig(): UseQueryResult<AdminMonetizationConfig> {
  const enabled = useBillingManage();
  return useQuery({
    queryKey: qk.monetization.config(),
    queryFn: ({ signal }) => monetizationApi.getConfig(signal),
    enabled,
    staleTime: 60_000,
  });
}

export function usePatchConfig(): UseMutationResult<
  AdminMonetizationConfig,
  Error,
  AdminMonetizationConfigPatch
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: AdminMonetizationConfigPatch) => monetizationApi.patchConfig(patch),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.monetization.all });
    },
  });
}

/**
 * A user's overrides. Disabled until an id is supplied — the screen takes an id as input because
 * there is no route that lists overrides across accounts, and none that resolves a handle to an id
 * without importing `features/users` (which the deletability rule forbids).
 */
export function useOverrides(userId: string): UseQueryResult<AdminEntitlementOverride[]> {
  const permitted = useBillingManage();
  return useQuery({
    queryKey: qk.monetization.overrides(userId),
    queryFn: ({ signal }) => monetizationApi.getOverrides(userId, signal),
    enabled: permitted && userId.length > 0,
  });
}

export function useGrantOverride(): UseMutationResult<
  AdminEntitlementOverride,
  Error,
  GrantOverridePayload
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: GrantOverridePayload) => monetizationApi.grantOverride(payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.monetization.all });
    },
  });
}

export function useRevokeOverride(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => monetizationApi.revokeOverride(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.monetization.all });
    },
  });
}
