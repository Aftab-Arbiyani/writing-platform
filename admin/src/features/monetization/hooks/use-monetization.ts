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
  AdjustCreditsPayload,
  AdminCoupon,
  AdminEntitlementOverride,
  AdminMonetizationConfig,
  AdminMonetizationConfigPatch,
  AdminPayment,
  AdminPaymentPage,
  AdminPlanCatalogue,
  AdminUserCredits,
  AdminUserSubscription,
  CreateCouponPayload,
  CreditAdjustResult,
  GrantOverridePayload,
  RefundPayload,
  RevenueAnalytics,
  SubscriptionAnalytics,
  UpdateCouponPayload,
  UsageAnalytics,
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

// ── Coupons (A1b) ─────────────────────────────────────────────────────────────

export function useCoupons(): UseQueryResult<AdminCoupon[]> {
  const enabled = useBillingManage();
  return useQuery({
    queryKey: qk.monetization.coupons(),
    queryFn: ({ signal }) => monetizationApi.getCoupons(signal),
    enabled,
  });
}

export function useCreateCoupon(): UseMutationResult<AdminCoupon, Error, CreateCouponPayload> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCouponPayload) => monetizationApi.createCoupon(payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.monetization.all });
    },
  });
}

export function useUpdateCoupon(): UseMutationResult<
  AdminCoupon,
  Error,
  { id: string; patch: UpdateCouponPayload }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateCouponPayload }) =>
      monetizationApi.updateCoupon(id, patch),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.monetization.all });
    },
  });
}

// ── Credits + refunds (A1b) ───────────────────────────────────────────────────

/**
 * Adjust a balance, then refresh the wallet the screen is showing. The response's post-clamp figure
 * is still what the form REPORTS — it is authoritative and arrives first — but the displayed balance
 * has to follow it, or the screen would keep showing the pre-adjustment number under a message
 * saying it changed.
 */
export function useAdjustCredits(): UseMutationResult<
  CreditAdjustResult,
  Error,
  AdjustCreditsPayload
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdjustCreditsPayload) => monetizationApi.adjustCredits(payload),
    onSuccess: (_result, payload) => {
      void client.invalidateQueries({ queryKey: qk.monetization.userCredits(payload.userId) });
    },
  });
}

/**
 * Refund a payment, then refresh the picker it was chosen from: the refund is recorded as a NEW
 * negative payment row on the same account, so the list is stale the moment this succeeds.
 */
export function useRefundPayment(): UseMutationResult<
  AdminPayment,
  Error,
  { paymentId: string; payload: RefundPayload; userId?: string }
> {
  const client = useQueryClient();
  return useMutation({
    // No annotation on the destructured param: re-declaring it here narrowed `TVariables` to the two
    // fields this call needs and dropped `userId`, which `onSuccess` below is the whole reason for.
    // The type comes from the hook's own `UseMutationResult` signature.
    mutationFn: ({ paymentId, payload }) => monetizationApi.refundPayment(paymentId, payload),
    onSuccess: (_payment, variables) => {
      if (variables.userId !== undefined && variables.userId !== '') {
        void client.invalidateQueries({
          queryKey: qk.monetization.userPayments(variables.userId),
        });
      }
    },
  });
}

// ── One account (B8) ──────────────────────────────────────────────────────────

/**
 * The three per-account reads, each disabled until an id is supplied and each answering a NORMAL
 * empty state rather than an error: `subscription: null` for a free account, `credits: null` for an
 * account that has never held one, an empty list for one that has never paid. Nothing here needs an
 * error branch for "this person has nothing".
 */
export function useUserSubscription(userId: string): UseQueryResult<AdminUserSubscription> {
  const permitted = useBillingManage();
  return useQuery({
    queryKey: qk.monetization.userSubscription(userId),
    queryFn: ({ signal }) => monetizationApi.getUserSubscription(userId, signal),
    enabled: permitted && userId.length > 0,
  });
}

export function useUserCredits(userId: string): UseQueryResult<AdminUserCredits> {
  const permitted = useBillingManage();
  return useQuery({
    queryKey: qk.monetization.userCredits(userId),
    queryFn: ({ signal }) => monetizationApi.getUserCredits(userId, signal),
    enabled: permitted && userId.length > 0,
  });
}

/**
 * One page of an account's payments, newest first.
 *
 * A page rather than an infinite list, and the picker SAYS so when there are more: a refund raised
 * from a support ticket concerns a recent charge, and paging back through years of history to find
 * it is not the flow. The cursor is on the wire if a later row needs it.
 */
export function useUserPayments(userId: string, limit = 20): UseQueryResult<AdminPaymentPage> {
  const permitted = useBillingManage();
  return useQuery({
    queryKey: qk.monetization.userPayments(userId),
    queryFn: ({ signal }) => monetizationApi.getUserPayments(userId, { limit, signal }),
    enabled: permitted && userId.length > 0,
  });
}

// ── Analytics (A1c) ───────────────────────────────────────────────────────────

/**
 * The three dashboards. Each keys independently so one failing read cannot blank another, and each
 * is computed on read from an append-only ledger server-side — there is no rollup table, so these are
 * the most expensive reads on this surface. A minute of staleness is the right trade for a revenue
 * figure nobody is watching second by second.
 */
export function useRevenueAnalytics(): UseQueryResult<RevenueAnalytics> {
  const enabled = useBillingManage();
  return useQuery({
    queryKey: qk.monetization.revenue(),
    queryFn: ({ signal }) => monetizationApi.getRevenue(signal),
    enabled,
    staleTime: 60_000,
  });
}

export function useSubscriptionAnalytics(): UseQueryResult<SubscriptionAnalytics> {
  const enabled = useBillingManage();
  return useQuery({
    queryKey: qk.monetization.subscriptions(),
    queryFn: ({ signal }) => monetizationApi.getSubscriptionAnalytics(signal),
    enabled,
    staleTime: 60_000,
  });
}

export function useUsageAnalytics(): UseQueryResult<UsageAnalytics> {
  const enabled = useBillingManage();
  return useQuery({
    queryKey: qk.monetization.usage(),
    queryFn: ({ signal }) => monetizationApi.getUsageAnalytics(signal),
    enabled,
    staleTime: 60_000,
  });
}
