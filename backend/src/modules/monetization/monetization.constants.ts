/**
 * Monetization module constants (AF5) — the module-local vocabulary: the settings keys
 * its admin-tunable config is stored under, the audit action/target strings it records,
 * and the cache-key prefixes for entitlement/usage caching. Kept local (not in the shared
 * error/permission catalogues) exactly like `settings.constants.ts` and
 * `retrieval.constants.ts`.
 */

/** Settings keys the monetization config is stored under (seeded in settings.catalog). */
export const MONETIZATION_SETTING_KEYS = {
  /** The plan catalogue (tier → PlanDefinition), admin-editable. */
  Plans: 'monetization.plans',
  /** Cross-cutting config: credit rate, trial/grace days, tax + currency tables. */
  Config: 'monetization.config',
} as const;

/** Audit-log `action` strings for monetization mutations (dot-cased target.verb). */
export const MONETIZATION_AUDIT_ACTIONS = {
  SubscriptionCreate: 'subscription.create',
  SubscriptionChange: 'subscription.change',
  SubscriptionCancel: 'subscription.cancel',
  SubscriptionReactivate: 'subscription.reactivate',
  SubscriptionPause: 'subscription.pause',
  SubscriptionResume: 'subscription.resume',
  PaymentRefund: 'payment.refund',
  WebhookProcess: 'webhook.process',
  EntitlementOverrideGrant: 'entitlement.override.grant',
  EntitlementOverrideRevoke: 'entitlement.override.revoke',
  CreditAdjust: 'credit.adjust',
  CouponCreate: 'coupon.create',
  CouponUpdate: 'coupon.update',
  ConfigUpdate: 'monetization.config.update',
} as const;

/** Audit-log `targetType` strings for monetization entities. */
export const MONETIZATION_AUDIT_TARGET = {
  Subscription: 'subscription',
  Payment: 'payment',
  Entitlement: 'entitlement',
  Wallet: 'credit_wallet',
  Coupon: 'coupon',
  Webhook: 'webhook',
  Config: 'monetization_config',
} as const;

/** Redis cache-key builders for entitlement/usage caching (namespace:purpose:v1:id). */
export const MONETIZATION_CACHE = {
  entitlements: (userId: string): string => `entitlement:snapshot:v1:${userId}`,
} as const;
