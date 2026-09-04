import {
  BillingInterval,
  ERROR_CODES,
  PaymentProvider,
  PlanTier,
  SubscriptionStatus,
} from '@qalam/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

import { monetizationApi } from '../api/monetization.api';
import type { SubscriptionResponse } from '../types/monetization.types';
import { isPaymentsUnavailable, useSubscription, useSubscriptionActions } from './use-subscription';

vi.mock('../api/monetization.api');
vi.mock('../lib/monetization-enabled');

const { isMonetizationEnabled } = await import('../lib/monetization-enabled');
const enabled = vi.mocked(isMonetizationEnabled);
const subscriptionRead = vi.mocked(monetizationApi.subscription);
const cancel = vi.mocked(monetizationApi.cancel);
const subscribe = vi.mocked(monetizationApi.subscribe);

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

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
  return { invalidate, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  enabled.mockReturnValue(true);
});

/**
 * The free-tier read.
 *
 * `GET /monetization/subscription` answers a privacy-preserving 404 for a user with no subscription
 * (verified live), which is the MAJORITY state — every free reader. If that reached the UI as an error,
 * the billing hub would show a failure to everyone who has never paid, where the correct surface is an
 * upsell.
 */
describe('useSubscription — no subscription', () => {
  it('maps SUBSCRIPTION_NOT_FOUND to null, not to an error', async () => {
    subscriptionRead.mockRejectedValue(
      new ApiError(404, {
        code: ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
        message: 'No subscription found.',
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('still errors on any OTHER failure, so a real problem is not laundered into "you are on free"', async () => {
    // A 403 is what a withheld `billing.use` looks like — the PBAC seed-grant defect fixed in
    // de61316. Swallowing it would make a broken permission grant indistinguishable from a free plan.
    subscriptionRead.mockRejectedValue(
      new ApiError(403, { code: ERROR_CODES.AUTH_PERMISSION_DENIED, message: 'denied' }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('does not fetch at all while the client flag is off', async () => {
    enabled.mockReturnValue(false);
    const { wrapper } = setup();
    renderHook(() => useSubscription(), { wrapper });
    await Promise.resolve();
    expect(subscriptionRead).not.toHaveBeenCalled();
  });
});

/**
 * Every lifecycle action must invalidate the ENTITLEMENT SNAPSHOT, not just the subscription.
 *
 * The snapshot is what gates read; the server derives it from the subscription and invalidates its own
 * copy on the same transition. A cancel that left a stale snapshot in place would keep premium
 * controls on screen after the plan that granted them ended.
 */
describe('useSubscriptionActions — cache invalidation', () => {
  it('invalidates subscription, entitlements and usage on success', async () => {
    cancel.mockResolvedValue(subscription({ cancelAtPeriodEnd: true }));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useSubscriptionActions(), { wrapper });

    result.current.cancel.mutate({});

    await waitFor(() => {
      expect(result.current.cancel.isSuccess).toBe(true);
    });

    const keys = invalidate.mock.calls.map(([arg]) => JSON.stringify(arg?.queryKey));
    expect(keys).toContain(JSON.stringify(qk.monetization.subscription()));
    expect(keys).toContain(JSON.stringify(qk.monetization.entitlements()));
    expect(keys).toContain(JSON.stringify(qk.monetization.usage()));
    // D5 dropped the credits key from this set: there is no wallet to refresh, and invalidating a
    // key nothing reads is a re-fetch of nothing.
  });

  it('cancels at period end by default — `immediate` is never sent implicitly', async () => {
    // Defaulting to an immediate cancellation would take away access the subscriber already paid for.
    cancel.mockResolvedValue(subscription({ cancelAtPeriodEnd: true }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useSubscriptionActions(), { wrapper });

    result.current.cancel.mutate({});
    await waitFor(() => {
      expect(result.current.cancel.isSuccess).toBe(true);
    });
    expect(cancel).toHaveBeenCalledWith({});
  });

  it('does not invalidate when the action fails', async () => {
    cancel.mockRejectedValue(
      new ApiError(409, {
        code: ERROR_CODES.SUBSCRIPTION_INVALID_TRANSITION,
        message: 'not allowed',
      }),
    );
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useSubscriptionActions(), { wrapper });

    result.current.cancel.mutate({});
    await waitFor(() => {
      expect(result.current.cancel.isError).toBe(true);
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('passes an accepted coupon through to checkout', async () => {
    subscribe.mockResolvedValue({
      subscription: subscription({ status: SubscriptionStatus.PendingActivation }),
      checkoutUrl: 'https://checkout.example/session',
      clientSecret: null,
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useSubscriptionActions(), { wrapper });

    result.current.subscribe.mutate({
      tier: PlanTier.Plus,
      interval: BillingInterval.Monthly,
      provider: PaymentProvider.Stripe,
      couponCode: 'LAUNCH20',
    });

    await waitFor(() => {
      expect(result.current.subscribe.isSuccess).toBe(true);
    });
    expect(subscribe).toHaveBeenCalledWith({
      tier: PlanTier.Plus,
      interval: BillingInterval.Monthly,
      provider: PaymentProvider.Stripe,
      couponCode: 'LAUNCH20',
    });
    // No `receipt`: a store receipt only exists on a device, and the web must never fabricate one.
    expect(subscribe.mock.calls[0]?.[0]).not.toHaveProperty('receipt');
  });
});

/**
 * The two 503s that mean "payments cannot happen here".
 *
 * Both are live, expected states on a deployment without payment credentials — and verified live, the
 * second is the answer for EVERY provider including `manual`, since no adapter is configurable without
 * third-party keys. Rendering them as a failed purchase would blame the reader for a deployment fact.
 */
describe('isPaymentsUnavailable', () => {
  it('recognises MONETIZATION_DISABLED and PAYMENT_PROVIDER_NOT_CONFIGURED', () => {
    expect(
      isPaymentsUnavailable(
        new ApiError(503, { code: ERROR_CODES.MONETIZATION_DISABLED, message: 'disabled' }),
      ),
    ).toBe(true);
    expect(
      isPaymentsUnavailable(
        new ApiError(503, {
          code: ERROR_CODES.PAYMENT_PROVIDER_NOT_CONFIGURED,
          message: 'not configured',
        }),
      ),
    ).toBe(true);
  });

  it('does not swallow a genuine purchase failure', () => {
    expect(
      isPaymentsUnavailable(
        new ApiError(402, { code: ERROR_CODES.PAYMENT_FAILED, message: 'declined' }),
      ),
    ).toBe(false);
    expect(
      isPaymentsUnavailable(
        new ApiError(409, {
          code: ERROR_CODES.SUBSCRIPTION_ALREADY_ACTIVE,
          message: 'already active',
        }),
      ),
    ).toBe(false);
    expect(isPaymentsUnavailable(new Error('network'))).toBe(false);
    expect(isPaymentsUnavailable(null)).toBe(false);
  });
});
