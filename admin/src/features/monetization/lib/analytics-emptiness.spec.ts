import { describe, expect, it } from 'vitest';

import {
  EMPTY_COPY,
  revenueIsEmpty,
  subscriptionsAreEmpty,
  usageIsEmpty,
} from './analytics-emptiness';
import type {
  RevenueAnalytics,
  SubscriptionAnalytics,
  UsageAnalytics,
} from '../types/monetization.types';

/**
 * The rules that keep a fabricated zero off the dashboards (A1c) — the W7c lesson, expressed as
 * predicates so they can be reasoned about without rendering anything.
 *
 * Each one reads a COUNT, never a SUM. A sum of zero is ambiguous; a count of zero is not.
 */
describe('revenueIsEmpty', () => {
  const revenue = (over: Partial<RevenueAnalytics> = {}): RevenueAnalytics => ({
    totalRevenue: 0,
    last30dRevenue: 0,
    refunded: 0,
    paymentsCount: 0,
    ...over,
  });

  it('is empty when no payment has ever succeeded', () => {
    expect(revenueIsEmpty(revenue())).toBe(true);
  });

  it('is NOT empty once a payment exists, even if it totalled nothing', () => {
    // A real payment that netted zero is a measurement; hiding it would lose it.
    expect(revenueIsEmpty(revenue({ paymentsCount: 1 }))).toBe(false);
  });

  it('is NOT empty when only refunds exist — that is real activity', () => {
    expect(revenueIsEmpty(revenue({ paymentsCount: 3, refunded: 5000 }))).toBe(false);
  });
});

describe('subscriptionsAreEmpty', () => {
  const subs = (over: Partial<SubscriptionAnalytics> = {}): SubscriptionAnalytics => ({
    byStatus: {},
    byTier: {},
    activeCount: 0,
    trialingCount: 0,
    last30d: { created: 0, upgraded: 0, downgraded: 0, canceled: 0 },
    ...over,
  });

  it('is empty when the status GROUP BY returned no rows', () => {
    expect(subscriptionsAreEmpty(subs())).toBe(true);
  });

  it('is NOT empty when every subscription is cancelled', () => {
    // The case that makes `activeCount` the wrong signal: zero active with real history is a churn
    // event an operator needs to see, not an absence of data.
    expect(subscriptionsAreEmpty(subs({ byStatus: { canceled: 9 }, activeCount: 0 }))).toBe(false);
  });
});

describe('usageIsEmpty', () => {
  const usage = (over: Partial<UsageAnalytics> = {}): UsageAnalytics => ({
    totalTokens: 0,
    totalCreditsConsumed: 0,
    totalCostUsd: 0,
    last30dCostUsd: 0,
    byFeature: [],
    ...over,
  });

  it('is empty with no feature rows and no tokens', () => {
    expect(usageIsEmpty(usage())).toBe(true);
  });

  it('is NOT empty when a feature has rows but reported no tokens', () => {
    // Attributable spend without token counts is still cost data.
    expect(
      usageIsEmpty(usage({ byFeature: [{ feature: 'craft_coach', tokens: 0, costUsd: 2.5 }] })),
    ).toBe(false);
  });

  it('is NOT empty when tokens exist without a feature attribution', () => {
    // `byFeature` excludes null features, so tokens can be counted with no rows to show.
    expect(usageIsEmpty(usage({ totalTokens: 1000 }))).toBe(false);
  });
});

describe('EMPTY_COPY', () => {
  it('explains WHY each dashboard is empty rather than just saying "no data"', () => {
    // An operator should read "nothing has happened yet", not "this screen is broken".
    expect(EMPTY_COPY.revenue.description).toMatch(/succeeded payments/i);
    expect(EMPTY_COPY.subscriptions.description).toMatch(/Nobody has subscribed/i);
    expect(EMPTY_COPY.usage.description).toMatch(/credit ledger/i);
  });

  it('gives each dashboard its own wording', () => {
    const titles = [EMPTY_COPY.revenue, EMPTY_COPY.subscriptions, EMPTY_COPY.usage].map(
      (c) => c.title,
    );
    expect(new Set(titles).size).toBe(3);
  });
});
