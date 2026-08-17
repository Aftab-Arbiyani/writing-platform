import type { OverrideEffect, PlanDefinition, PlanTier, PremiumFeature } from '@qalam/shared';

/**
 * Wire shapes for the admin monetization surface (A1, docs/45 §5).
 *
 * Declared here rather than imported from `@qalam/api-types` because that package carries the
 * USER-facing monetization contract only — subscription, entitlements, usage, credits, invoices,
 * payments, plans, coupon validation. It has no admin shapes: no coupon record, no entitlement
 * override, no resolved config, and none of the three analytics payloads. This mirrors what
 * `features/operations/types` does for P7.4.
 *
 * Every one of these is READ from a frozen backend (`admin-monetization.controller.ts`). The types
 * follow the controller's mappers exactly; where a field is nullable here it is nullable there.
 */

/** `GET /admin/monetization/plans` — the RESOLVED catalogue (stored folded over compiled defaults). */
export type AdminPlanCatalogue = Record<PlanTier, PlanDefinition>;

/**
 * `GET/PATCH /admin/monetization/config` — the cross-cutting config.
 *
 * ⚠️ Only the four numeric fields are PATCHable. `UpdateMonetizationConfigDto` declares no
 * properties for `taxRates`, `currencyRates` or `regionCurrency`, so they come back on the read and
 * cannot be written through this route even though the service layer would merge them (recorded in
 * docs/48 §3 as A1-2). The config form treats them as read-only for that reason, not by choice.
 */
export interface AdminMonetizationConfig {
  creditsPerUsd: number;
  trialDays: number;
  gracePeriodDays: number;
  lowCreditThreshold: number;
  taxRates: Record<string, number>;
  currencyRates: Record<string, number>;
  regionCurrency: Record<string, string>;
}

/** The four fields `PATCH config` actually accepts. */
export interface AdminMonetizationConfigPatch {
  creditsPerUsd?: number;
  trialDays?: number;
  gracePeriodDays?: number;
  lowCreditThreshold?: number;
}

/** `GET /admin/monetization/overrides/:userId` — `toEntitlementOverrideDto`. */
export interface AdminEntitlementOverride {
  id: string;
  userId: string;
  feature: PremiumFeature;
  effect: OverrideEffect;
  active: boolean;
  expiresAt: string | null;
  reason: string | null;
  createdAt: string;
}

/** `POST /admin/monetization/overrides` — `GrantOverrideDto`. */
export interface GrantOverridePayload {
  userId: string;
  feature: PremiumFeature;
  effect: OverrideEffect;
  /** ISO date the grant lapses. Omit for a permanent override. */
  expiresAt?: string;
  reason?: string;
  /** Free-text provenance, e.g. `promotional` / `support` / `temporary`. */
  source?: string;
  limit?: number;
}
