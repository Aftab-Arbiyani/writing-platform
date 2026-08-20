import { PlanTier, Role } from '@qalam/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import { RevenueDashboardPage } from './revenue-dashboard-page';
import { SubscriptionsDashboardPage } from './subscriptions-dashboard-page';
import { UsageDashboardPage } from './usage-dashboard-page';
import type {
  RevenueAnalytics,
  SubscriptionAnalytics,
  UsageAnalytics,
} from '../types/monetization.types';

/**
 * The three A1c dashboards, each in the four states the row requires: loading, empty, populated and
 * errored.
 *
 * The EMPTY case is the one that earns its place. All three endpoints compute on read, so a young
 * install returns a well-formed response full of zeroes — and rendering that as a measurement is the
 * defect W7c recorded against the reader stats page. Each dashboard is asserted to withhold its
 * figures entirely when there is no data, not merely to show `0`.
 */
vi.mock('../api/monetization.api');

const { monetizationApi } = await import('../api/monetization.api');
const getRevenue = vi.mocked(monetizationApi.getRevenue);
const getSubs = vi.mocked(monetizationApi.getSubscriptionAnalytics);
const getUsage = vi.mocked(monetizationApi.getUsageAnalytics);
const getUserSubscription = vi.mocked(monetizationApi.getUserSubscription);

/** A fresh install: complete response, every number zero. Nothing here is a measurement. */
const EMPTY_REVENUE: RevenueAnalytics = {
  totalRevenue: 0,
  last30dRevenue: 0,
  refunded: 0,
  paymentsCount: 0,
  byCurrency: [],
};
/** A single-currency install: the scalars and the one grouped row agree, which is the common case. */
const REVENUE: RevenueAnalytics = {
  totalRevenue: 1_250_000,
  last30dRevenue: 90_000,
  refunded: 4_990,
  paymentsCount: 312,
  byCurrency: [
    {
      currency: 'usd',
      totalRevenue: 1_250_000,
      last30dRevenue: 90_000,
      refunded: 4_990,
      paymentsCount: 312,
    },
  ],
};
/** The install A1-6 was about: the scalars add dollars to yen and mean nothing. */
const MIXED_REVENUE: RevenueAnalytics = {
  totalRevenue: 1_254_000,
  last30dRevenue: 90_000,
  refunded: 4_990,
  paymentsCount: 315,
  byCurrency: [
    {
      currency: 'usd',
      totalRevenue: 1_250_000,
      last30dRevenue: 90_000,
      refunded: 4_990,
      paymentsCount: 312,
    },
    { currency: 'jpy', totalRevenue: 4_000, last30dRevenue: 0, refunded: 0, paymentsCount: 3 },
  ],
};

const EMPTY_SUBS: SubscriptionAnalytics = {
  byStatus: {},
  byTier: {},
  activeCount: 0,
  trialingCount: 0,
  last30d: { created: 0, upgraded: 0, downgraded: 0, canceled: 0 },
};
const SUBS: SubscriptionAnalytics = {
  byStatus: { active: 120, canceled: 18, trialing: 7 },
  byTier: { plus: 90, pro: 37 },
  activeCount: 120,
  trialingCount: 7,
  last30d: { created: 22, upgraded: 5, downgraded: 2, canceled: 4 },
};

const EMPTY_USAGE: UsageAnalytics = {
  totalTokens: 0,
  totalCreditsConsumed: 0,
  totalCostUsd: 0,
  last30dCostUsd: 0,
  byFeature: [],
};
const USAGE: UsageAnalytics = {
  totalTokens: 4_500_000,
  totalCreditsConsumed: 12_500,
  totalCostUsd: 124.5,
  last30dCostUsd: 31.2,
  byFeature: [
    { feature: 'writing_assistant', tokens: 3_000_000, costUsd: 90 },
    { feature: 'ask_book', tokens: 1_500_000, costUsd: 34.5 },
  ],
};

function apiError(): ApiError {
  return new ApiError(500, {
    code: 'INTERNAL_ERROR',
    message: 'boom',
    details: [],
    requestId: 'req-9',
  });
}

/** A promise that never settles — the first-load state. */
function pending<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  // The reads are gated on `billing.manage` via `enabled`, so without a role the queries never fire
  // and the pages render nothing. That gating is deliberate (an operator without the grant should not
  // provoke a 403), which means every dashboard test has to establish the grant first.
  useAuthStore.setState({ status: 'authenticated', role: Role.Admin });
});

afterEach(() => useAuthStore.getState().clear());

describe('RevenueDashboardPage', () => {
  it('shows a skeleton while the first read is in flight', () => {
    getRevenue.mockReturnValue(pending<RevenueAnalytics>());
    renderWithProviders(<RevenueDashboardPage />);

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('Total revenue')).not.toBeInTheDocument();
  });

  it('says there is no data rather than printing a fabricated zero', async () => {
    getRevenue.mockResolvedValue(EMPTY_REVENUE);
    renderWithProviders(<RevenueDashboardPage />);

    expect(await screen.findByText('No payments recorded yet')).toBeInTheDocument();
    // The whole point: no stat tile, so nothing reads as "revenue is zero this month".
    expect(screen.queryByText('Total revenue')).not.toBeInTheDocument();
    expect(screen.queryByText('Last 30 days')).not.toBeInTheDocument();
  });

  it('renders the figures once payments exist', async () => {
    getRevenue.mockResolvedValue(REVENUE);
    renderWithProviders(<RevenueDashboardPage />);

    expect(await screen.findByText('Total revenue')).toBeInTheDocument();
    expect(screen.getByText((1_250_000).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText('312')).toBeInTheDocument();
    expect(screen.queryByText('No payments recorded yet')).not.toBeInTheDocument();
  });

  it('states that refunds are not netted off, and why the scalars carry no symbol', async () => {
    getRevenue.mockResolvedValue(REVENUE);
    renderWithProviders(<RevenueDashboardPage />);

    expect(await screen.findByText(/deducted from total/)).toBeInTheDocument();
    expect(screen.getByText(/add unlike units/)).toBeInTheDocument();
  });

  it('prints each currency as money, with that currency’s own decimal places', async () => {
    // A1-6's closure. USD's minor unit is 1/100 and JPY has none, so 1_250_000 is $12,500.00 while
    // 4_000 is ¥4,000 — hard-coding `/100` is the M5-3 defect and would print ¥40.
    getRevenue.mockResolvedValue(MIXED_REVENUE);
    renderWithProviders(<RevenueDashboardPage />);

    expect(await screen.findByText('By currency')).toBeInTheDocument();
    expect(screen.getByText(/\$12,500\.00/)).toBeInTheDocument();
    // Matched loosely because the symbol's exact form is the runtime locale's business (`JP¥` in a
    // US locale). The CLAIM under test is the exponent: yen are not divided by 100.
    expect(screen.getByText(/¥4,000(?!\.)/)).toBeInTheDocument();
  });

  it('keeps the cross-currency scalars symbol-free beside the grouped figures', async () => {
    // Both are shown and they disagree by design: the scalars are the pre-B8 arithmetic, kept
    // because they are a shipped shape, and they must never be dressed up as a currency amount.
    getRevenue.mockResolvedValue(MIXED_REVENUE);
    renderWithProviders(<RevenueDashboardPage />);

    expect(await screen.findByText('Total revenue')).toBeInTheDocument();
    expect(screen.getByText((1_254_000).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText(/All succeeded payments, minor units/)).toBeInTheDocument();
  });

  it('shows the house error panel with a retry when the read fails', async () => {
    getRevenue.mockRejectedValue(apiError());
    renderWithProviders(<RevenueDashboardPage />);

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('Total revenue')).not.toBeInTheDocument();
  });
});

describe('SubscriptionsDashboardPage', () => {
  it('shows a skeleton while loading', () => {
    getSubs.mockReturnValue(pending<SubscriptionAnalytics>());
    renderWithProviders(<SubscriptionsDashboardPage />);

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('says there are no subscriptions rather than showing zero active', async () => {
    getSubs.mockResolvedValue(EMPTY_SUBS);
    renderWithProviders(<SubscriptionsDashboardPage />);

    expect(await screen.findByText('No subscriptions yet')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('does NOT treat an install with only cancelled subscriptions as empty', async () => {
    // `activeCount: 0` with real rows behind it is a churn event worth seeing, so emptiness reads
    // `byStatus` instead. Flattening this to "no data" would hide it.
    getSubs.mockResolvedValue({
      ...EMPTY_SUBS,
      byStatus: { canceled: 9 },
      byTier: { plus: 9 },
    });
    renderWithProviders(<SubscriptionsDashboardPage />);

    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('No subscriptions yet')).not.toBeInTheDocument();
    expect(screen.getByText('canceled')).toBeInTheDocument();
  });

  it('renders both distributions and the 30-day movement', async () => {
    getSubs.mockResolvedValue(SUBS);
    renderWithProviders(<SubscriptionsDashboardPage />);

    expect(await screen.findByText('By status')).toBeInTheDocument();
    expect(screen.getByText('By tier')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    // 120 appears twice by design — once as the Active stat tile, once as the `active` status row —
    // so this asserts the count rather than a single node.
    expect(screen.getAllByText('120')).toHaveLength(2);
    expect(screen.getByText('trialing')).toBeInTheDocument();
    expect(screen.getByText('pro')).toBeInTheDocument();
  });

  it('looks up one account and shows its subscription', async () => {
    // A1's premise, finally closed (A1-7): the page carries the lookup rather than a sentence
    // explaining that no endpoint exists for it.
    getSubs.mockResolvedValue(SUBS);
    getUserSubscription.mockResolvedValue({
      userId: 'u-1',
      subscription: {
        id: 'sub-1',
        tier: PlanTier.Plus,
        status: 'active',
        interval: 'monthly',
        provider: 'stripe',
        currency: 'usd',
        autoRenew: true,
        cancelAtPeriodEnd: false,
        currentPeriodStart: '2026-08-01T00:00:00.000Z',
        currentPeriodEnd: '2026-09-01T00:00:00.000Z',
        trialEnd: null,
        gracePeriodEnd: null,
        canceledAt: null,
        scheduledTier: null,
        scheduledInterval: null,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    });
    renderWithProviders(<SubscriptionsDashboardPage />);

    fireEvent.change(await screen.findByLabelText('User ID'), { target: { value: 'u-1' } });

    expect(await screen.findByText('Subscription')).toBeInTheDocument();
    expect(screen.getByText('sub-1')).toBeInTheDocument();
  });

  it('renders a free account as a calm statement, not an error', async () => {
    // DECISION 0.2: `subscription: null` is the platform's commonest account state. An error banner
    // here would send an operator looking for a problem that is not there.
    getSubs.mockResolvedValue(SUBS);
    getUserSubscription.mockResolvedValue({ userId: 'u-2', subscription: null });
    renderWithProviders(<SubscriptionsDashboardPage />);

    fireEvent.change(await screen.findByLabelText('User ID'), { target: { value: 'u-2' } });

    expect(await screen.findByText('Free plan')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // The compensating sentence is GONE, and its absence is asserted rather than merely deleted
    // (B8-1 closed, docs/48 §3.22a): the read now 404s an id that belongs to nobody, so a null means
    // "this account is on free" and nothing else. Copy about an ambiguity that no longer exists would
    // send an operator to re-check an ID the server already rejected.
    expect(screen.queryByText(/does not exist reads the same way/i)).not.toBeInTheDocument();
  });

  it('offers the lookup even on an install with no subscriptions at all', async () => {
    // The emptiness check governs the AGGREGATES. An operator can still need to confirm that a
    // particular account is on free, and that answer exists whether or not anyone has ever paid.
    getSubs.mockResolvedValue(EMPTY_SUBS);
    renderWithProviders(<SubscriptionsDashboardPage />);

    expect(await screen.findByText('Look up one account')).toBeInTheDocument();
  });

  it('shows the error panel on failure', async () => {
    getSubs.mockRejectedValue(apiError());
    renderWithProviders(<SubscriptionsDashboardPage />);

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('UsageDashboardPage', () => {
  it('shows a skeleton while loading', () => {
    getUsage.mockReturnValue(pending<UsageAnalytics>());
    renderWithProviders(<UsageDashboardPage />);

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('says there is no AI usage rather than printing zero cost', async () => {
    getUsage.mockResolvedValue(EMPTY_USAGE);
    renderWithProviders(<UsageDashboardPage />);

    expect(await screen.findByText('No AI usage recorded yet')).toBeInTheDocument();
    expect(screen.queryByText('Total tokens')).not.toBeInTheDocument();
  });

  it('is NOT empty when features have rows but no token counts', async () => {
    // Both signals are required: a provider that reported no tokens still produced attributable
    // spend, and hiding it would lose real cost data.
    getUsage.mockResolvedValue({
      ...EMPTY_USAGE,
      byFeature: [{ feature: 'craft_coach', tokens: 0, costUsd: 2.5 }],
    });
    renderWithProviders(<UsageDashboardPage />);

    expect(await screen.findByText('Total tokens')).toBeInTheDocument();
    expect(screen.queryByText('No AI usage recorded yet')).not.toBeInTheDocument();
  });

  it('renders the totals and the per-feature table', async () => {
    getUsage.mockResolvedValue(USAGE);
    renderWithProviders(<UsageDashboardPage />);

    expect(await screen.findByText('Total tokens')).toBeInTheDocument();
    expect(screen.getByText('writing_assistant')).toBeInTheDocument();
    expect(screen.getByText('ask_book')).toBeInTheDocument();
    expect(screen.getByText((4_500_000).toLocaleString())).toBeInTheDocument();
  });

  it('shows the error panel on failure', async () => {
    getUsage.mockRejectedValue(apiError());
    renderWithProviders(<UsageDashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });
    expect(screen.queryByText('Total tokens')).not.toBeInTheDocument();
  });
});
