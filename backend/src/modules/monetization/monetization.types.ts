import type { BillingInterval, PlanDefinition, PlanTier } from '@qalam/shared';

/**
 * Internal monetization types (AF5) — the resolved config shapes and service-layer
 * contracts. Wire shapes (request/response) live in DTOs; the client contract in
 * `@qalam/api-types`. This file is backend-internal.
 */

/** Cross-cutting monetization config (the `monetization.config` JSON setting, resolved). */
export interface ResolvedMonetizationConfig {
  /** Credits granted per USD of AI spend when converting cost → credits. */
  /** Default free-trial length (days) when a plan does not override it. */
  trialDays: number;
  /** Dunning/grace window (days) after a failed renewal before access ends. */
  gracePeriodDays: number;
  /** Warn the user when their credit balance drops below this. */
  /** Tax rate (fraction, e.g. 0.2 = 20%) by region code; `default` is the fallback. */
  taxRates: Record<string, number>;
  /** Currency conversion multiplier vs USD (e.g. inr: 83). */
  currencyRates: Record<string, number>;
  /** Region code → preferred currency (regional pricing). */
  regionCurrency: Record<string, string>;
}

/** The resolved plan catalogue (tier → definition), merged over compiled defaults. */
export type ResolvedPlanCatalogue = Record<PlanTier, PlanDefinition>;

/** A partial patch to the monetization config (admin update). */
export interface MonetizationConfigPatch {
  trialDays?: number;
  gracePeriodDays?: number;
  taxRates?: Record<string, number>;
  currencyRates?: Record<string, number>;
  regionCurrency?: Record<string, string>;
}

/** A computed price for a plan+interval in a currency (minor units, after any discount). */
export interface ComputedPrice {
  tier: PlanTier;
  interval: BillingInterval;
  currency: string;
  /** Base list price before discount (minor units). */
  amount: number;
  /** Discount applied from a coupon (minor units). */
  discount: number;
  /** Net amount charged (minor units). */
  net: number;
}
