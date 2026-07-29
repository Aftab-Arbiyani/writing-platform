/**
 * Monetization wire types (AF5, W4 — docs/37). Re-exported from `@qalam/api-types` (the single
 * wire contract) so this feature imports everything monetization-related from one local path,
 * exactly as `features/ai` does — never redefining a shape the backend owns.
 *
 * The vocabulary (`PlanTier`, `SubscriptionStatus`, `EntitlementStatus`, `PremiumFeature`, …) is
 * `@qalam/shared`'s and is re-exported through `@qalam/api-types`; a second copy of a tier list is
 * a second thing to fall out of step with the server.
 */
export type {
  BillingInterval,
  CancelSubscriptionRequest,
  ChangePlanRequest,
  CheckoutResponse,
  CreateSubscriptionRequest,
  CreditBalanceResponse,
  CreditReason,
  CreditTransactionResponse,
  EntitlementDecision,
  EntitlementReason,
  EntitlementSnapshot,
  EntitlementStatus,
  FeatureEntitlementResponse,
  InvoiceResponse,
  InvoiceStatus,
  PaymentMethodType,
  PaymentProvider,
  PaymentResponse,
  PaymentStatus,
  PlanDefinition,
  PlanLimits,
  PlanTier,
  PlansResponse,
  PremiumFeature,
  PurchaseCreditsRequest,
  PurchaseKind,
  PurchaseResponse,
  PurchaseStatus,
  QuotaWindow,
  SubscriptionEventResponse,
  SubscriptionResponse,
  SubscriptionStatus,
  UsageSummaryResponse,
  UsageWindowResponse,
  ValidateCouponRequest,
  ValidateCouponResponse,
} from '@qalam/api-types';

/**
 * The result of `POST /monetization/purchases/restore`.
 *
 * **Declared here rather than imported, because `@qalam/api-types` has it wrong.** That package
 * declares `RestorePurchasesResponse` as `{ restored, subscription, creditsGranted }`; the
 * controller returns `{ restored, providerRef, expiresAt }` — a different shape with no field in
 * common beyond `restored` (`monetization.controller.ts#restore`, verified live). Importing the
 * package's version would type-check against a response that never arrives, so this is the shape
 * the server actually sends. The drift is recorded as a defect, not fixed here (docs/48 §3.6, W4-2).
 */
export interface RestorePurchasesResult {
  restored: number;
  providerRef: string | null;
  expiresAt: string | null;
}
