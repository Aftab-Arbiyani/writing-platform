import {
  ERROR_CODES,
  type BillingInterval,
  type PaymentProvider,
  type PlanTier,
} from '@qalam/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

import { monetizationApi } from '../api/monetization.api';
import { isMonetizationEnabled } from '../lib/monetization-enabled';
import type { SubscriptionResponse } from '../types/monetization.types';

/** Identity tier (docs/12 §2.2): who the viewer is to the billing system. */
const SUBSCRIPTION_STALE = 60 * 1000;

/** Whether an error is a specific server code. */
function hasCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}

/**
 * Whether this error means "payments cannot happen here", as opposed to "that request was wrong".
 *
 * Two distinct 503s share one meaning for a reader: the platform flag is down
 * (`MONETIZATION_DISABLED`, the pre-seeded default) or the deployment has no payment credentials
 * (`PAYMENT_PROVIDER_NOT_CONFIGURED` — which, verified live, is the answer for *every* provider
 * including `manual`, since no adapter is configurable without third-party keys). Neither is the
 * reader's fault and neither is retryable by them, so both render the same honest state instead of a
 * failed-purchase error.
 */
export function isPaymentsUnavailable(error: unknown): boolean {
  return (
    hasCode(error, ERROR_CODES.MONETIZATION_DISABLED) ||
    hasCode(error, ERROR_CODES.PAYMENT_PROVIDER_NOT_CONFIGURED)
  );
}

/**
 * The viewer's subscription, or `null` when they have none (AF5, W4).
 *
 * **`SUBSCRIPTION_NOT_FOUND` is mapped to `null`, not surfaced as an error.** Having no subscription
 * is the ordinary free-tier state — the majority state — and the backend expresses it as a
 * privacy-preserving 404 rather than an empty body. Letting that reach the UI as an error would show
 * every free reader a failure where the correct surface is an upsell. Mobile's
 * `currentSubscriptionProvider` makes exactly the same mapping, for the same reason.
 *
 * Every other failure still errors, so a genuine problem is not laundered into "you're on free".
 */
export function useSubscription() {
  return useQuery({
    queryKey: qk.monetization.subscription(),
    queryFn: async ({ signal }): Promise<SubscriptionResponse | null> => {
      try {
        return await monetizationApi.subscription(signal);
      } catch (error) {
        if (hasCode(error, ERROR_CODES.SUBSCRIPTION_NOT_FOUND)) return null;
        throw error;
      }
    },
    enabled: isMonetizationEnabled(),
    staleTime: SUBSCRIPTION_STALE,
  });
}

/**
 * The subscription lifecycle actions (AF5, W4): subscribe, change plan, cancel, reactivate, pause,
 * resume.
 *
 * **None is optimistic.** Every one of them can be refused by the server for a reason the client
 * cannot predict — `SUBSCRIPTION_ALREADY_ACTIVE`, `PLAN_CHANGE_NOOP`,
 * `SUBSCRIPTION_INVALID_TRANSITION`, `TRIAL_NOT_ELIGIBLE`, and both payments-unavailable 503s — and
 * flipping a plan badge to "Pro" and then back is telling someone they bought something they did not.
 *
 * **Each invalidates the entitlement snapshot as well as the subscription.** The snapshot is what
 * gates read, the server derives it from the subscription, and its own cache is invalidated on the
 * same transition — so a cancel that left a stale snapshot in place would keep premium controls on
 * screen after the plan that granted them ended. Usage and credits go too: a tier change moves the
 * quota limits and the monthly credit grant.
 */
export function useSubscriptionActions() {
  const client = useQueryClient();

  const invalidate = async (): Promise<void> => {
    await Promise.all([
      client.invalidateQueries({ queryKey: qk.monetization.subscription() }),
      client.invalidateQueries({ queryKey: qk.monetization.entitlements() }),
      client.invalidateQueries({ queryKey: qk.monetization.usage() }),
      client.invalidateQueries({ queryKey: qk.monetization.credits() }),
    ]);
  };

  /**
   * Start a checkout.
   *
   * Answers a provider-hosted `checkoutUrl` for the caller to send the reader to, or an activated
   * subscription with a null url. `receipt` is never sent from a browser — a store receipt only
   * exists on a device — so on the web this is the card path or nothing.
   */
  const subscribe = useMutation({
    mutationFn: (input: {
      tier: PlanTier;
      interval: BillingInterval;
      provider: PaymentProvider;
      couponCode?: string;
    }) => monetizationApi.subscribe(input),
    onSuccess: invalidate,
  });

  const changePlan = useMutation({
    mutationFn: (input: { tier: PlanTier; interval: BillingInterval; atPeriodEnd?: boolean }) =>
      monetizationApi.changePlan(input),
    onSuccess: invalidate,
  });

  /** Cancels at period end by default — the subscriber keeps what they already paid for. */
  const cancel = useMutation({
    mutationFn: (input: { immediate?: boolean; reason?: string } = {}) =>
      monetizationApi.cancel(input),
    onSuccess: invalidate,
  });

  const reactivate = useMutation({
    mutationFn: () => monetizationApi.reactivate(),
    onSuccess: invalidate,
  });

  const pause = useMutation({
    mutationFn: () => monetizationApi.pause(),
    onSuccess: invalidate,
  });

  const resume = useMutation({
    mutationFn: () => monetizationApi.resume(),
    onSuccess: invalidate,
  });

  return { subscribe, changePlan, cancel, reactivate, pause, resume };
}
