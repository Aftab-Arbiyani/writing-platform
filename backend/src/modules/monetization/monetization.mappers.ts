import type { EntitlementSnapshot } from '@qalam/shared';

import type { Coupon } from './entities/coupon.entity';
import type { CreditTransaction } from './entities/credit-transaction.entity';
import type { CreditWallet } from './entities/credit-wallet.entity';
import type { EntitlementOverride } from './entities/entitlement-override.entity';
import type { Invoice } from './entities/invoice.entity';
import type { Payment } from './entities/payment.entity';
import type { Purchase } from './entities/purchase.entity';
import type { Subscription } from './entities/subscription.entity';
import type { SubscriptionEvent } from './entities/subscription-event.entity';
import type {
  CouponDto,
  CreditBalanceDto,
  CreditTransactionDto,
  EntitlementOverrideDto,
  EntitlementSnapshotDto,
  InvoiceDto,
  PaymentDto,
  PurchaseDto,
  SubscriptionDto,
  SubscriptionEventDto,
  UsageSummaryDto,
} from './dto/monetization-response.dto';
import type { UsageSummary } from './usage.service';

/** Entity → response DTO mappers (AF5). Controllers never return entities raw. */

export function toSubscriptionDto(s: Subscription): SubscriptionDto {
  return {
    id: s.id,
    tier: s.tier,
    status: s.status,
    interval: s.interval,
    provider: s.provider,
    currency: s.currency,
    autoRenew: s.autoRenew,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    currentPeriodStart: s.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
    trialEnd: s.trialEnd?.toISOString() ?? null,
    gracePeriodEnd: s.gracePeriodEnd?.toISOString() ?? null,
    canceledAt: s.canceledAt?.toISOString() ?? null,
    scheduledTier: s.scheduledTier,
    scheduledInterval: s.scheduledInterval,
    createdAt: s.createdAt.toISOString(),
  };
}

export function toSubscriptionEventDto(e: SubscriptionEvent): SubscriptionEventDto {
  return {
    id: e.id,
    type: e.type,
    fromTier: e.fromTier,
    toTier: e.toTier,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    createdAt: e.createdAt.toISOString(),
  };
}

export function toEntitlementSnapshotDto(snapshot: EntitlementSnapshot): EntitlementSnapshotDto {
  return {
    tier: snapshot.tier,
    status: snapshot.status,
    features: snapshot.features.map((decision) => ({
      feature: decision.feature,
      status: decision.status,
      allowed: decision.allowed,
      reason: decision.reason,
      expiresAt: decision.expiresAt,
      remaining: decision.remaining,
      limit: decision.limit,
    })),
    refreshAt: snapshot.refreshAt,
  };
}

export function toUsageSummaryDto(summary: UsageSummary): UsageSummaryDto {
  return {
    daily: summary.daily,
    monthly: summary.monthly,
    total: summary.total,
    byFeature: summary.byFeature,
    forecastMonthlyTokens: summary.forecastMonthlyTokens,
    forecastMonthlyCostUsd: summary.forecastMonthlyCostUsd,
  };
}

export function toCreditBalanceDto(wallet: CreditWallet, creditsPerUsd: number): CreditBalanceDto {
  return {
    balance: wallet.balance,
    lifetimeGranted: wallet.lifetimeGranted,
    lifetimeConsumed: wallet.lifetimeConsumed,
    creditsPerUsd,
    updatedAt: wallet.updatedAt.toISOString(),
  };
}

export function toCreditTransactionDto(t: CreditTransaction): CreditTransactionDto {
  return {
    id: t.id,
    type: t.type,
    reason: t.reason,
    delta: t.delta,
    balanceAfter: t.balanceAfter,
    feature: t.feature,
    tokens: t.tokens,
    costUsd: t.costUsd,
    createdAt: t.createdAt.toISOString(),
  };
}

export function toInvoiceDto(i: Invoice): InvoiceDto {
  return {
    id: i.id,
    number: i.number,
    status: i.status,
    currency: i.currency,
    subtotal: i.subtotal,
    tax: i.tax,
    total: i.total,
    periodStart: i.periodStart?.toISOString() ?? null,
    periodEnd: i.periodEnd?.toISOString() ?? null,
    paidAt: i.paidAt?.toISOString() ?? null,
    hostedUrl: i.hostedUrl,
    pdfUrl: i.pdfUrl,
    createdAt: i.createdAt.toISOString(),
  };
}

export function toPaymentDto(p: Payment): PaymentDto {
  return {
    id: p.id,
    provider: p.provider,
    method: p.method,
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    description: p.description,
    createdAt: p.createdAt.toISOString(),
  };
}

export function toPurchaseDto(p: Purchase): PurchaseDto {
  return {
    id: p.id,
    kind: p.kind,
    status: p.status,
    provider: p.provider,
    amount: p.amount,
    currency: p.currency,
    creditsGranted: p.creditsGranted,
    createdAt: p.createdAt.toISOString(),
  };
}

export function toCouponDto(c: Coupon): CouponDto {
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    value: c.value,
    active: c.active,
    redemptions: c.redemptions,
    maxRedemptions: c.maxRedemptions,
    campaign: c.campaign,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

export function toEntitlementOverrideDto(o: EntitlementOverride): EntitlementOverrideDto {
  return {
    id: o.id,
    userId: o.userId,
    feature: o.feature,
    effect: o.effect,
    active: o.active,
    expiresAt: o.expiresAt?.toISOString() ?? null,
    reason: o.reason,
    createdAt: o.createdAt.toISOString(),
  };
}
