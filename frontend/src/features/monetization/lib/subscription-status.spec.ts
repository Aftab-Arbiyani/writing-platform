import { BillingInterval, PaymentProvider, PlanTier, SubscriptionStatus } from '@qalam/shared';
import { describe, expect, it } from 'vitest';

import { formatDate } from '@/lib/format';

import { resolveStatusBanner } from './subscription-status';
import type { SubscriptionResponse } from '../types/monetization.types';

const PERIOD_END = '2026-08-28T00:00:00.000Z';

function subscription(over: Partial<SubscriptionResponse> = {}): SubscriptionResponse {
  return {
    id: 'sub-1',
    tier: PlanTier.Plus,
    status: SubscriptionStatus.Active,
    interval: BillingInterval.Monthly,
    provider: PaymentProvider.Stripe,
    currency: 'usd',
    autoRenew: true,
    cancelAtPeriodEnd: false,
    currentPeriodStart: '2026-07-28T00:00:00.000Z',
    currentPeriodEnd: PERIOD_END,
    trialEnd: null,
    gracePeriodEnd: null,
    canceledAt: null,
    scheduledTier: null,
    scheduledInterval: null,
    createdAt: '2026-07-28T00:00:00.000Z',
    ...over,
  };
}

describe('resolveStatusBanner — the healthy case', () => {
  it('says nothing about an ordinary active subscription', () => {
    // A billing page that always warns about something trains people to ignore it.
    expect(resolveStatusBanner(subscription())).toBeNull();
  });
});

describe('resolveStatusBanner — each state', () => {
  it('warns about a failed payment with the deadline to fix it', () => {
    const banner = resolveStatusBanner(
      subscription({
        status: SubscriptionStatus.GracePeriod,
        gracePeriodEnd: '2026-08-04T00:00:00.000Z',
      }),
    );
    expect(banner?.tone).toBe('danger');
    expect(banner?.text).toMatch(/payment failed/i);
    expect(banner?.text).toContain(formatDate('2026-08-04T00:00:00.000Z'));
  });

  it('treats past_due the same as grace_period', () => {
    // Both mean a renewal failed inside the dunning window, and both still grant access
    // (ACCESS_GRANTING_SUBSCRIPTION_STATUSES). Distinguishing them for a reader adds no remedy.
    const banner = resolveStatusBanner(subscription({ status: SubscriptionStatus.PastDue }));
    expect(banner?.text).toMatch(/payment failed/i);
  });

  it('still warns about a failed payment when there is no grace deadline', () => {
    const banner = resolveStatusBanner(subscription({ status: SubscriptionStatus.GracePeriod }));
    expect(banner?.text).toMatch(/payment failed/i);
    expect(banner?.text).not.toMatch(/undefined|null|Invalid/i);
  });

  it('reports an ended plan', () => {
    expect(resolveStatusBanner(subscription({ status: SubscriptionStatus.Expired }))?.text).toMatch(
      /plan has ended/i,
    );
    expect(
      resolveStatusBanner(subscription({ status: SubscriptionStatus.Canceled }))?.text,
    ).toMatch(/plan has ended/i);
  });

  it('reports a pause', () => {
    const banner = resolveStatusBanner(subscription({ status: SubscriptionStatus.Paused }));
    expect(banner?.tone).toBe('warning');
    expect(banner?.text).toMatch(/paused/i);
  });

  it('reports a trial with its end date', () => {
    const banner = resolveStatusBanner(
      subscription({ status: SubscriptionStatus.Trialing, trialEnd: '2026-08-11T00:00:00.000Z' }),
    );
    expect(banner?.tone).toBe('info');
    expect(banner?.text).toContain(`trial ends on ${formatDate('2026-08-11T00:00:00.000Z')}`);
  });

  it('reports a pending cancellation and that access continues until then', () => {
    const banner = resolveStatusBanner(subscription({ cancelAtPeriodEnd: true }));
    expect(banner?.text).toContain(`Cancels on ${formatDate(PERIOD_END)}`);
    expect(banner?.text).toMatch(/keep your plan until then/i);
  });

  it('reports a scheduled plan change', () => {
    const banner = resolveStatusBanner(subscription({ scheduledTier: PlanTier.Plus }));
    expect(banner?.tone).toBe('info');
    expect(banner?.text).toContain(`Changing to Plus on ${formatDate(PERIOD_END)}`);
  });
});

/**
 * The precedence. Every case below has two or more true conditions, which is the ordinary situation
 * rather than an edge case — so which one speaks is the whole design of this function.
 */
describe('resolveStatusBanner — precedence when several states are true at once', () => {
  it('a failed payment outranks a pending cancellation', () => {
    // Both are typical of a subscription winding down, but only one is still fixable.
    const banner = resolveStatusBanner(
      subscription({
        status: SubscriptionStatus.GracePeriod,
        cancelAtPeriodEnd: true,
        gracePeriodEnd: '2026-08-04T00:00:00.000Z',
      }),
    );
    expect(banner?.text).toMatch(/payment failed/i);
  });

  it('an ended plan outranks a pause and a scheduled change', () => {
    const banner = resolveStatusBanner(
      subscription({
        status: SubscriptionStatus.Expired,
        scheduledTier: PlanTier.Pro,
      }),
    );
    expect(banner?.text).toMatch(/plan has ended/i);
  });

  it('a pending cancellation outranks the trial it is cancelling', () => {
    // A cancelled trial is still a trial, but the cancellation is the newer fact and the one with a
    // consequence — saying "your trial ends on the 11th" hides that nothing follows it.
    const banner = resolveStatusBanner(
      subscription({
        status: SubscriptionStatus.Trialing,
        trialEnd: '2026-08-11T00:00:00.000Z',
        cancelAtPeriodEnd: true,
      }),
    );
    expect(banner?.text).toMatch(/Cancels on/);
  });

  it('a scheduled change is last — it only speaks when nothing else does', () => {
    const banner = resolveStatusBanner(
      subscription({ status: SubscriptionStatus.Paused, scheduledTier: PlanTier.Pro }),
    );
    expect(banner?.text).toMatch(/paused/i);
  });
});
