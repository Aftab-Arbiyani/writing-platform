import {
  BillingInterval,
  ERROR_CODES,
  PaymentProvider,
  PlanTier,
  SubscriptionStatus,
} from '@qalam/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';

import { monetizationApi } from '../api/monetization.api';
import type {
  PlanDefinition,
  PlansResponse,
  SubscriptionResponse,
} from '../types/monetization.types';
import { PlansPage } from './plans-page';

vi.mock('../api/monetization.api');
vi.mock('../lib/monetization-enabled');

const { isMonetizationEnabled } = await import('../lib/monetization-enabled');
const enabled = vi.mocked(isMonetizationEnabled);
const plans = vi.mocked(monetizationApi.plans);
const subscriptionRead = vi.mocked(monetizationApi.subscription);
const subscribe = vi.mocked(monetizationApi.subscribe);
const changePlan = vi.mocked(monetizationApi.changePlan);
const entitlements = vi.mocked(monetizationApi.entitlements);

function plan(over: Partial<PlanDefinition> = {}): PlanDefinition {
  return {
    tier: PlanTier.Plus,
    name: 'Plus',
    description: 'Plus plan',
    features: ['ai_budget', 'ai_writing'] as never,
    limits: { aiDailyTokens: 100_000, aiMonthlyTokens: 2_000_000, aiMonthlyCredits: 5_000 },
    monthlyCredits: 5_000,
    prices: { monthly: { usd: 499 }, yearly: { usd: 4990 } },
    trialDays: 14,
    ...over,
  };
}

/** The catalogue as the live server actually answers it — free priced under `none`, not `monthly`. */
function catalogue(): PlansResponse {
  return {
    plans: [
      plan({
        tier: PlanTier.Free,
        name: 'Free',
        features: ['ai_budget'] as never,
        monthlyCredits: 0,
        prices: { none: { usd: 0 } },
        trialDays: 0,
      }),
      plan(),
      plan({
        tier: PlanTier.Pro,
        name: 'Pro',
        prices: { monthly: { usd: 1499 }, yearly: { usd: 14_990 } },
      }),
    ],
    currency: 'usd',
    region: null,
  };
}

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
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    trialEnd: null,
    gracePeriodEnd: null,
    canceledAt: null,
    scheduledTier: null,
    scheduledInterval: null,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

const NO_SUBSCRIPTION = new ApiError(404, {
  code: ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
  message: 'No subscription found.',
});

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  enabled.mockReturnValue(true);
  plans.mockResolvedValue(catalogue());
  entitlements.mockRejectedValue(NO_SUBSCRIPTION);
});

describe('PlansPage — rendering the catalogue', () => {
  it('prices each plan for the selected interval', async () => {
    subscriptionRead.mockRejectedValue(NO_SUBSCRIPTION);
    renderWithProviders(<PlansPage />);

    expect(await screen.findByText('$4.99')).toBeInTheDocument();
    expect(screen.getByText('$14.99')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Yearly' }));
    expect(await screen.findByText('$49.90')).toBeInTheDocument();
    expect(screen.getByText('$149.90')).toBeInTheDocument();
  });

  it('shows the free tier as "Free", never as a $0.00 monthly price', async () => {
    // The live catalogue prices free under the `none` interval, so indexing `monthly` on it is
    // undefined — not zero. Printing "$0.00 / mo" would invent a price the server never quoted.
    subscriptionRead.mockRejectedValue(NO_SUBSCRIPTION);
    renderWithProviders(<PlansPage />);

    expect(await screen.findByRole('heading', { name: 'Free', level: 3 })).toBeInTheDocument();
    // The price line reads "Free" too — the plan name and its price, both.
    expect(screen.getAllByText('Free')).toHaveLength(2);
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('marks the current plan and offers it no button', async () => {
    subscriptionRead.mockResolvedValue(subscription({ tier: PlanTier.Plus }));
    renderWithProviders(<PlansPage />);

    expect(await screen.findByText('Current plan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /to Plus/ })).not.toBeInTheDocument();
  });

  it('says "Upgrade" going up and "Switch" going down', async () => {
    subscriptionRead.mockResolvedValue(subscription({ tier: PlanTier.Pro }));
    renderWithProviders(<PlansPage />);

    // On Pro: Plus is a downgrade.
    expect(await screen.findByRole('button', { name: /Switch to Plus/ })).toBeInTheDocument();
  });
});

/**
 * The split that matters most on this page: a new subscriber goes through checkout, an existing one
 * through a plan change. Getting it wrong either charges someone twice or asks a stranger to change a
 * plan they never had.
 */
describe('PlansPage — which write fires', () => {
  it('subscribes (checkout) when there is no subscription', async () => {
    subscriptionRead.mockRejectedValue(NO_SUBSCRIPTION);
    subscribe.mockResolvedValue({
      subscription: subscription({ status: SubscriptionStatus.PendingActivation }),
      checkoutUrl: null,
      clientSecret: null,
    });
    renderWithProviders(<PlansPage />);

    fireEvent.click(await screen.findByRole('button', { name: /to Plus/ }));

    await waitFor(() => {
      expect(subscribe).toHaveBeenCalledWith({
        tier: PlanTier.Plus,
        interval: BillingInterval.Monthly,
        provider: PaymentProvider.Stripe,
        couponCode: undefined,
      });
    });
    expect(changePlan).not.toHaveBeenCalled();
  });

  it('changes the plan when a subscription exists, scheduling a DOWNGRADE for period end', async () => {
    // A downgrade must not take away what the subscriber already paid for.
    subscriptionRead.mockResolvedValue(subscription({ tier: PlanTier.Pro }));
    changePlan.mockResolvedValue(
      subscription({ tier: PlanTier.Pro, scheduledTier: PlanTier.Plus }),
    );
    renderWithProviders(<PlansPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Switch to Plus/ }));

    await waitFor(() => {
      expect(changePlan).toHaveBeenCalledWith({
        tier: PlanTier.Plus,
        interval: BillingInterval.Monthly,
        atPeriodEnd: true,
      });
    });
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('applies an UPGRADE immediately', async () => {
    subscriptionRead.mockResolvedValue(subscription({ tier: PlanTier.Plus }));
    changePlan.mockResolvedValue(subscription({ tier: PlanTier.Pro }));
    renderWithProviders(<PlansPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Upgrade to Pro/ }));

    await waitFor(() => {
      expect(changePlan).toHaveBeenCalledWith({
        tier: PlanTier.Pro,
        interval: BillingInterval.Monthly,
        atPeriodEnd: false,
      });
    });
  });

  it('hides the promo field from an existing subscriber', async () => {
    // `ChangePlanDto` has no `couponCode` and the app runs `forbidNonWhitelisted`, so sending one would
    // 400 the whole change — the same trap as mobile's M-1 (docs/48 §3.6, W4-5).
    subscriptionRead.mockResolvedValue(subscription());
    renderWithProviders(<PlansPage />);

    await screen.findByText('Current plan');
    expect(screen.queryByLabelText('Promo code')).not.toBeInTheDocument();
  });
});

/**
 * The state this deployment actually ships. Every payment adapter is key-gated and there is no inert
 * or manual fallback, so a checkout on a stack without third-party credentials is refused — and the UI
 * must say so rather than fake a purchase.
 */
describe('PlansPage — payments unavailable', () => {
  it('explains a MONETIZATION_DISABLED refusal without blaming the reader', async () => {
    subscriptionRead.mockRejectedValue(NO_SUBSCRIPTION);
    subscribe.mockRejectedValue(
      new ApiError(503, {
        code: ERROR_CODES.MONETIZATION_DISABLED,
        message: 'Monetization is not currently available.',
      }),
    );
    renderWithProviders(<PlansPage />);

    fireEvent.click(await screen.findByRole('button', { name: /to Plus/ }));
    expect(await screen.findByText(/Payments aren’t available yet/i)).toBeInTheDocument();
  });

  it('names the missing provider configuration when that is the reason', async () => {
    subscriptionRead.mockRejectedValue(NO_SUBSCRIPTION);
    subscribe.mockRejectedValue(
      new ApiError(503, {
        code: ERROR_CODES.PAYMENT_PROVIDER_NOT_CONFIGURED,
        message: 'Payment provider "stripe" is not configured.',
      }),
    );
    renderWithProviders(<PlansPage />);

    fireEvent.click(await screen.findByRole('button', { name: /to Plus/ }));
    expect(await screen.findByText(/no payment provider set up/i)).toBeInTheDocument();
    expect(screen.getByText(/Nothing was charged/i)).toBeInTheDocument();
  });

  it('shows a real refusal as an error, not as "payments unavailable"', async () => {
    subscriptionRead.mockRejectedValue(NO_SUBSCRIPTION);
    subscribe.mockRejectedValue(
      new ApiError(409, {
        code: ERROR_CODES.SUBSCRIPTION_ALREADY_ACTIVE,
        message: 'already active',
      }),
    );
    renderWithProviders(<PlansPage />);

    fireEvent.click(await screen.findByRole('button', { name: /to Plus/ }));
    expect(await screen.findByText(/already have an active subscription/i)).toBeInTheDocument();
  });
});

describe('PlansPage — the dark client', () => {
  it('offers nothing and fetches nothing while the flag is off', async () => {
    enabled.mockReturnValue(false);
    renderWithProviders(<PlansPage />);

    expect(await screen.findByText('Plans aren’t available yet')).toBeInTheDocument();
    expect(plans).not.toHaveBeenCalled();
  });
});
