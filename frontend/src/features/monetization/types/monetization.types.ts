/**
 * Monetization wire types (AF5, W4 — docs/37). Re-exported from `@umberleaf/api-types` (the single
 * wire contract) so this feature imports everything monetization-related from one local path,
 * exactly as `features/ai` does — never redefining a shape the backend owns.
 *
 * The vocabulary (`PlanTier`, `SubscriptionStatus`, `EntitlementStatus`, `PremiumFeature`, …) is
 * `@umberleaf/shared`'s and is re-exported through `@umberleaf/api-types`; a second copy of a tier list is
 * a second thing to fall out of step with the server.
 */
export type {
  BillingInterval,
  CancelSubscriptionRequest,
  ChangePlanRequest,
  CheckoutResponse,
  CreateSubscriptionRequest,
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
  PurchaseKind,
  PurchaseResponse,
  FeatureQuotaResponse,
  PurchaseStatus,
  QuotaWindow,
  RestorePurchasesResponse,
  SubscriptionEventResponse,
  SubscriptionResponse,
  SubscriptionStatus,
  UsageSummaryResponse,
  ValidateCouponRequest,
  ValidateCouponResponse,
} from '@umberleaf/api-types';

// A re-export does not bring the name into local scope, so the alias below needs its own import.
import type { RestorePurchasesResponse as ApiRestorePurchasesResponse } from '@umberleaf/api-types';

/**
 * The result of `POST /monetization/purchases/restore`.
 *
 * **Now a plain alias of the package type.** W4 declared this shape locally because
 * `@umberleaf/api-types` had it wrong — it said `{ restored, subscription, creditsGranted }` where the
 * controller returns `{ restored, providerRef, expiresAt }`. W4-2 fixed the package against the
 * controller and pinned all three together (`monetization-contract.spec.ts`), so the local copy would
 * now be a second definition of a shape that already has one authority. The alias is kept only so the
 * feature's existing imports keep working.
 */
export type RestorePurchasesResult = ApiRestorePurchasesResponse;
