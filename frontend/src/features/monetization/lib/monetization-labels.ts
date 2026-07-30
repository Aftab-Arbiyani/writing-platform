import {
  BillingInterval,
  CreditReason,
  EntitlementReason,
  EntitlementStatus,
  InvoiceStatus,
  PaymentProvider,
  PaymentStatus,
  PlanTier,
  PremiumFeature,
  PurchaseKind,
  PurchaseStatus,
  QuotaWindow,
  SubscriptionStatus,
} from '@qalam/shared';

/**
 * Human labels for the monetization vocabulary (AF5, W4) — presentation only, so no surface ever
 * prints a raw wire string at a reader.
 *
 * Ported from mobile's `domain_labels.dart` and extended: mobile labels five of the thirteen
 * enumerations and lets the rest fall through to the wire value, which is why its billing history
 * shows `"succeeded"` and its credit ledger shows `"subscription grant"` (an underscore-stripped
 * `subscription_grant`). Web's history and ledger render the same rows, so the missing eight are
 * mapped here.
 *
 * Every function falls back to the raw value rather than throwing or blanking: these enumerations are
 * deliberately OPEN on the wire (varchar columns, so a new tier or provider lands without a
 * migration — docs/37), so an unknown value is a forward-compatible server, not a bug. Showing it
 * verbatim is worse copy than a real label and much better than an empty cell.
 */

export function planLabel(tier: PlanTier | string): string {
  switch (tier) {
    case PlanTier.Free:
      return 'Free';
    case PlanTier.Plus:
      return 'Plus';
    case PlanTier.Pro:
      return 'Pro';
    case PlanTier.Enterprise:
      return 'Enterprise';
    default:
      return tier;
  }
}

/**
 * A cadence. `none` renders empty rather than as the word "None": it means "not recurring", and it
 * appears on the free tier and on non-recurring purchases, where "Billed none" would be nonsense.
 * Callers check for the empty string before rendering a "Billed …" line.
 */
export function intervalLabel(interval: BillingInterval | string): string {
  switch (interval) {
    case BillingInterval.Monthly:
      return 'Monthly';
    case BillingInterval.Yearly:
      return 'Yearly';
    case BillingInterval.None:
      return '';
    default:
      return interval;
  }
}

/** The short form beside a price: "$4.99 / mo". */
export function intervalSuffix(interval: BillingInterval | string): string {
  switch (interval) {
    case BillingInterval.Monthly:
      return 'mo';
    case BillingInterval.Yearly:
      return 'yr';
    default:
      return '';
  }
}

export function subscriptionStatusLabel(status: SubscriptionStatus | string): string {
  switch (status) {
    case SubscriptionStatus.PendingActivation:
      return 'Pending activation';
    case SubscriptionStatus.Trialing:
      return 'Free trial';
    case SubscriptionStatus.Active:
      return 'Active';
    case SubscriptionStatus.PastDue:
      return 'Payment overdue';
    case SubscriptionStatus.GracePeriod:
      return 'Grace period';
    case SubscriptionStatus.Paused:
      return 'Paused';
    case SubscriptionStatus.Canceled:
      return 'Cancelled';
    case SubscriptionStatus.Expired:
      return 'Expired';
    default:
      return status;
  }
}

export function featureLabel(feature: PremiumFeature | string): string {
  switch (feature) {
    case PremiumFeature.AiWriting:
      return 'AI writing assistant';
    case PremiumFeature.AiDiscovery:
      return 'AI discovery';
    case PremiumFeature.StoryIntelligence:
      return 'Story intelligence';
    case PremiumFeature.PremiumSearch:
      return 'Premium search';
    case PremiumFeature.PremiumRecommendations:
      return 'Premium recommendations';
    case PremiumFeature.AdvancedAnalytics:
      return 'Advanced analytics';
    case PremiumFeature.PublishingPro:
      return 'Pro publishing';
    case PremiumFeature.AiBudget:
      return 'AI allowance';
    case PremiumFeature.Marketplace:
      return 'Marketplace';
    case PremiumFeature.Collaboration:
      return 'Collaboration';
    case PremiumFeature.Enterprise:
      return 'Enterprise';
    default:
      return feature;
  }
}

/**
 * Why the Entitlement Service decided what it decided.
 *
 * Worth labelling rather than hiding, because the reason is the difference between remedies a reader
 * can act on: `quota_exceeded` means wait, `plan_excludes` means upgrade, and `suspended` means
 * neither will help. The gate's copy is chosen from this, not from the status alone.
 */
export function entitlementReasonLabel(reason: EntitlementReason | string): string {
  switch (reason) {
    case EntitlementReason.PlanIncludes:
      return 'Included in your plan';
    case EntitlementReason.Trial:
      return 'Included in your trial';
    case EntitlementReason.GracePeriod:
      return 'Available during your grace period';
    case EntitlementReason.Promotional:
      return 'Included by a promotion';
    case EntitlementReason.TemporaryAccess:
      return 'Temporarily available';
    case EntitlementReason.AdminOverride:
      return 'Granted for your account';
    case EntitlementReason.LegacyPlan:
      return 'Included in your legacy plan';
    case EntitlementReason.QuotaExceeded:
      return 'You’ve used your allowance';
    case EntitlementReason.NoSubscription:
      return 'Needs a paid plan';
    case EntitlementReason.PlanExcludes:
      return 'Not in your current plan';
    case EntitlementReason.FeatureDisabled:
      return 'Not available yet';
    case EntitlementReason.Suspended:
      return 'Unavailable while your account is suspended';
    case EntitlementReason.Expired:
      return 'Your plan has expired';
    case EntitlementReason.DeniedOverride:
      return 'Unavailable on your account';
    default:
      return reason;
  }
}

export function entitlementStatusLabel(status: EntitlementStatus | string): string {
  switch (status) {
    case EntitlementStatus.Allow:
      return 'Included';
    case EntitlementStatus.Limited:
      return 'Limited';
    case EntitlementStatus.Trial:
      return 'Trial';
    case EntitlementStatus.GracePeriod:
      return 'Grace period';
    case EntitlementStatus.Deny:
      return 'Not included';
    case EntitlementStatus.Expired:
      return 'Expired';
    case EntitlementStatus.Suspended:
      return 'Suspended';
    case EntitlementStatus.PendingActivation:
      return 'Pending activation';
    case EntitlementStatus.Cancelled:
      return 'Cancelled';
    case EntitlementStatus.Paused:
      return 'Paused';
    default:
      return status;
  }
}

export function invoiceStatusLabel(status: InvoiceStatus | string): string {
  switch (status) {
    case InvoiceStatus.Draft:
      return 'Draft';
    case InvoiceStatus.Open:
      return 'Due';
    case InvoiceStatus.Paid:
      return 'Paid';
    case InvoiceStatus.Void:
      return 'Void';
    case InvoiceStatus.Uncollectible:
      return 'Uncollectible';
    case InvoiceStatus.Refunded:
      return 'Refunded';
    default:
      return status;
  }
}

export function paymentStatusLabel(status: PaymentStatus | string): string {
  switch (status) {
    case PaymentStatus.Pending:
      return 'Pending';
    case PaymentStatus.Succeeded:
      return 'Paid';
    case PaymentStatus.Failed:
      return 'Failed';
    case PaymentStatus.Refunded:
      return 'Refunded';
    case PaymentStatus.PartiallyRefunded:
      return 'Partly refunded';
    case PaymentStatus.Disputed:
      return 'Disputed';
    case PaymentStatus.Canceled:
      return 'Cancelled';
    default:
      return status;
  }
}

export function providerLabel(provider: PaymentProvider | string): string {
  switch (provider) {
    case PaymentProvider.Stripe:
      return 'Card';
    case PaymentProvider.AppleAppStore:
      return 'App Store';
    case PaymentProvider.GooglePlay:
      return 'Google Play';
    case PaymentProvider.Manual:
      return 'Manual';
    default:
      return provider;
  }
}

export function purchaseKindLabel(kind: PurchaseKind | string): string {
  switch (kind) {
    case PurchaseKind.Subscription:
      return 'Subscription';
    case PurchaseKind.Credits:
      return 'AI credits';
    case PurchaseKind.OneTime:
      return 'One-time';
    default:
      return kind;
  }
}

export function purchaseStatusLabel(status: PurchaseStatus | string): string {
  switch (status) {
    case PurchaseStatus.Pending:
      return 'Pending';
    case PurchaseStatus.Completed:
      return 'Completed';
    case PurchaseStatus.Failed:
      return 'Failed';
    case PurchaseStatus.Refunded:
      return 'Refunded';
    case PurchaseStatus.Restored:
      return 'Restored';
    default:
      return status;
  }
}

/** Why a credit-ledger row exists. The ledger is the only place a reader sees these. */
export function creditReasonLabel(reason: CreditReason | string): string {
  switch (reason) {
    case CreditReason.Purchase:
      return 'Credit purchase';
    case CreditReason.SubscriptionGrant:
      return 'Plan allowance';
    case CreditReason.TrialGrant:
      return 'Trial allowance';
    case CreditReason.Promotional:
      return 'Promotion';
    case CreditReason.Referral:
      return 'Referral';
    case CreditReason.AiUsage:
      return 'AI usage';
    case CreditReason.Refund:
      return 'Refund';
    case CreditReason.Expiration:
      return 'Expired';
    case CreditReason.AdminAdjustment:
      return 'Adjustment';
    default:
      return reason;
  }
}

/** A usage window's heading. `total` is lifetime, which is what the reader understands it as. */
export function usageWindowLabel(window: QuotaWindow | string): string {
  switch (window) {
    case QuotaWindow.Daily:
      return 'Today';
    case QuotaWindow.Monthly:
      return 'This month';
    case QuotaWindow.Total:
      return 'Lifetime';
    default:
      return window;
  }
}
