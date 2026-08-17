import { api } from '@/lib/api-client';

import type {
  AdminEntitlementOverride,
  AdminMonetizationConfig,
  AdminMonetizationConfigPatch,
  AdminPlanCatalogue,
  GrantOverridePayload,
} from '../types/monetization.types';

/**
 * The monetization feature's `api/` layer (A1) — the only place its endpoints are named.
 *
 * Every route mounts under `/admin/monetization/*` (the api-client adds the `/api/v1` prefix and
 * unwraps the `{success,data,meta}` envelope) and every one requires `billing.manage`; the server
 * re-checks on each call regardless of what the router let through.
 *
 * **What is deliberately absent, because the backend has no such route** (A1's audit, docs/48 §3):
 * there is no admin read for one user's subscription, none for their credit balance, and none that
 * lists payments. Those are `@CurrentUser` self-scoped on the public controller, so an admin cannot
 * reach another account through them. Anything here that looks like it should exist and does not is
 * a recorded gap, not an omission.
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
};
