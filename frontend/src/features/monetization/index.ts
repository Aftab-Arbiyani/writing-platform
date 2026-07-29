/**
 * Public surface of the monetization feature (AF5, W4 — docs/45 §4).
 *
 * Imported by the lazy `settings/billing*` route modules; everything else stays private to the
 * feature, so it remains deletable with one `rm -rf`.
 *
 * `PremiumGate`, `PremiumBadge` and `useEntitlement` are exported because premium gating is
 * consumed outside these five pages — but they are exported from HERE rather than lifted into `app/`,
 * because they are monetization's own vocabulary. A feature that needs to meet monetization does it
 * through an app-level seam, never by importing this (docs/26 §4): `features/ai` reaches the upgrade
 * state through `lib/error-messages` + its own availability vocabulary, not through this module.
 */
export { SubscriptionPage } from './pages/subscription-page';
export { PlansPage } from './pages/plans-page';
export { UsagePage } from './pages/usage-page';
export { CreditsPage } from './pages/credits-page';
export { BillingHistoryPage } from './pages/billing-history-page';

export { PremiumGate, FeatureLockCard, EntitlementExpiryNote } from './components/premium-gate';
export { PremiumBadge } from './components/premium-badge';
export { PaymentsUnavailable } from './components/payments-unavailable';

export { useEntitlements, useEntitlement } from './hooks/use-entitlements';
export type { EntitlementVerdict } from './hooks/use-entitlements';
export {
  useSubscription,
  useSubscriptionActions,
  isPaymentsUnavailable,
} from './hooks/use-subscription';
export { usePlans, useValidateCoupon } from './hooks/use-plans';
export { useMonetizationUsage, isExhausted, isUnlimited, remainingTokens } from './hooks/use-usage';
export { useCreditBalance, useCreditLedger } from './hooks/use-credits';
export {
  useInvoices,
  usePayments,
  usePurchases,
  useSubscriptionHistory,
} from './hooks/use-billing-history';

export { isMonetizationEnabled } from './lib/monetization-enabled';
export { clearCachedEntitlements } from './lib/entitlement-cache';
export { allows, decisionFor, isPremium, isQuotaDenial } from './lib/entitlement-decisions';
export { formatMoney, formatTokens, formatUsd } from './lib/monetization-format';
export { featureLabel, planLabel } from './lib/monetization-labels';

export type {
  CreditBalanceResponse,
  CreditTransactionResponse,
  EntitlementDecision,
  EntitlementSnapshot,
  InvoiceResponse,
  PaymentResponse,
  PlanDefinition,
  PlansResponse,
  PurchaseResponse,
  RestorePurchasesResult,
  SubscriptionEventResponse,
  SubscriptionResponse,
  UsageSummaryResponse,
  UsageWindowResponse,
} from './types/monetization.types';
