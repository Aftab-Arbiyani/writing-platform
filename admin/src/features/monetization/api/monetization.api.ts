import { api } from '@/lib/api-client';

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
 * The monetization feature's `api/` layer (A1) — the only place its endpoints are named.
 *
 * Every route mounts under `/admin/monetization/*` (the api-client adds the `/api/v1` prefix and
 * unwraps the `{success,data,meta}` envelope) and every one requires `billing.manage`; the server
 * re-checks on each call regardless of what the router let through.
 *
 * The three `users/:userId/*` reads landed with B8 and are what A1 recorded as missing: an operator
 * can now see one account's subscription, payments and credit balance rather than only aggregates.
 */
export const monetizationApi = {
  // ── Plans + config (A1a) ────────────────────────────────────────────────────
  getPlans: (signal?: AbortSignal): Promise<AdminPlanCatalogue> =>
    api.get<AdminPlanCatalogue>('/admin/monetization/plans', { signal }).then((r) => r.data),

  getConfig: (signal?: AbortSignal): Promise<AdminMonetizationConfig> =>
    api.get<AdminMonetizationConfig>('/admin/monetization/config', { signal }).then((r) => r.data),

  patchConfig: (patch: AdminMonetizationConfigPatch): Promise<AdminMonetizationConfig> =>
    api.patch<AdminMonetizationConfig>('/admin/monetization/config', patch).then((r) => r.data),

  // ── Entitlement overrides (A1a) ─────────────────────────────────────────────
  getOverrides: (userId: string, signal?: AbortSignal): Promise<AdminEntitlementOverride[]> =>
    api
      .get<AdminEntitlementOverride[]>(`/admin/monetization/overrides/${userId}`, { signal })
      .then((r) => r.data),

  grantOverride: (payload: GrantOverridePayload): Promise<AdminEntitlementOverride> =>
    api
      .post<AdminEntitlementOverride>('/admin/monetization/overrides', payload)
      .then((r) => r.data),

  /** 204 No Content — the override row is deactivated, not deleted. */
  revokeOverride: (id: string): Promise<void> =>
    api.delete<void>(`/admin/monetization/overrides/${id}`).then(() => undefined),

  // ── Coupons (A1b) ───────────────────────────────────────────────────────────
  getCoupons: (signal?: AbortSignal): Promise<AdminCoupon[]> =>
    api.get<AdminCoupon[]>('/admin/monetization/coupons', { signal }).then((r) => r.data),

  /** Fails with COUPON_CODE_TAKEN (409) — the one error the operator can fix in place. */
  createCoupon: (payload: CreateCouponPayload): Promise<AdminCoupon> =>
    api.post<AdminCoupon>('/admin/monetization/coupons', payload).then((r) => r.data),

  updateCoupon: (id: string, payload: UpdateCouponPayload): Promise<AdminCoupon> =>
    api.patch<AdminCoupon>(`/admin/monetization/coupons/${id}`, payload).then((r) => r.data),

  // ── Credits + refunds (A1b) ─────────────────────────────────────────────────
  /** Positive grants, negative deducts. The response balance is post-clamp and authoritative. */
  adjustCredits: (payload: AdjustCreditsPayload): Promise<CreditAdjustResult> =>
    api.post<CreditAdjustResult>('/admin/monetization/credits/adjust', payload).then((r) => r.data),

  /**
   * Fails with PAYMENT_NOT_FOUND (404), PAYMENT_NOT_REFUNDABLE (409), PAYMENT_PROVIDER_ERROR (502)
   * or …NOT_CONFIGURED (503). The 409 was split out of the 404 by B8 (A1-1): a payment that exists
   * but was never captured at a provider is not a wrong id.
   */
  refundPayment: (paymentId: string, payload: RefundPayload): Promise<AdminPayment> =>
    api
      .post<AdminPayment>(`/admin/monetization/payments/${paymentId}/refund`, payload)
      .then((r) => r.data),

  // ── One account (B8) ────────────────────────────────────────────────────────
  getUserSubscription: (userId: string, signal?: AbortSignal): Promise<AdminUserSubscription> =>
    api
      .get<AdminUserSubscription>(`/admin/monetization/users/${userId}/subscription`, { signal })
      .then((r) => r.data),

  getUserCredits: (userId: string, signal?: AbortSignal): Promise<AdminUserCredits> =>
    api
      .get<AdminUserCredits>(`/admin/monetization/users/${userId}/credits`, { signal })
      .then((r) => r.data),

  /**
   * Keyset-paginated, newest first. The cursor rides in `meta.pagination` alongside `hasMore`, which
   * is the monetization ledgers' envelope — NOT the offset `{page,total}` shape `ApiPagination`
   * describes, hence the narrowing below rather than a straight read.
   */
  getUserPayments: (
    userId: string,
    options?: { cursor?: string; limit?: number; signal?: AbortSignal },
  ): Promise<AdminPaymentPage> =>
    api
      .get<AdminPayment[]>(`/admin/monetization/users/${userId}/payments`, {
        // `buildUrl` drops undefined keys, so an absent cursor means "first page" without the
        // caller assembling a query string.
        query: { cursor: options?.cursor, limit: options?.limit },
        signal: options?.signal,
      })
      .then((r) => {
        const cursorMeta = r.meta?.pagination as unknown as
          { nextCursor?: string | null; hasMore?: boolean } | undefined;
        return {
          items: r.data,
          nextCursor: cursorMeta?.nextCursor ?? null,
          hasMore: cursorMeta?.hasMore ?? false,
        };
      }),

  // ── Analytics (A1c) — read-only, no failure modes beyond transport ───────────
  getRevenue: (signal?: AbortSignal): Promise<RevenueAnalytics> =>
    api
      .get<RevenueAnalytics>('/admin/monetization/analytics/revenue', { signal })
      .then((r) => r.data),

  getSubscriptionAnalytics: (signal?: AbortSignal): Promise<SubscriptionAnalytics> =>
    api
      .get<SubscriptionAnalytics>('/admin/monetization/analytics/subscriptions', { signal })
      .then((r) => r.data),

  getUsageAnalytics: (signal?: AbortSignal): Promise<UsageAnalytics> =>
    api.get<UsageAnalytics>('/admin/monetization/analytics/usage', { signal }).then((r) => r.data),
};
