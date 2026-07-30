import type { BillingInterval, PlanTier } from '@qalam/shared';
import { useMutation, useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { monetizationApi } from '../api/monetization.api';
import { isMonetizationEnabled } from '../lib/monetization-enabled';

/**
 * The plan catalogue (AF5, W4).
 *
 * **One hour** — the Taxonomy tier (docs/12 §2.2). Plans come from the admin-tunable pricing config
 * rather than a table, and a price change is an admin action measured in months, not minutes. This is
 * the most cacheable read in the feature.
 */
const PLANS_STALE = 60 * 60 * 1000;

export function usePlans(region?: string) {
  return useQuery({
    queryKey: qk.monetization.plans(region),
    queryFn: ({ signal }) => monetizationApi.plans(region, signal),
    enabled: isMonetizationEnabled(),
    staleTime: PLANS_STALE,
  });
}

/**
 * Coupon preview (AF5, W4) — `POST /monetization/coupons/validate`.
 *
 * **A mutation despite being a read**, because it is a POST that is rate-limited on the `billing`
 * tier: modelling it as a query would let TanStack refetch it on mount, on reconnect, and on any key
 * change, and burn a tight write-tier budget on a code the reader typed once. A mutation fires
 * exactly when they ask.
 *
 * **An invalid code resolves, it does not reject.** The endpoint answers `{ valid: false }` rather
 * than throwing (the controller catches both coupon exceptions — confirmed live), so `onError` is for
 * transport and rate-limit failures only, and the UI branches on `data.valid`.
 *
 * `tier` and `interval` are passed through because the server only computes `discountedAmount` when it
 * has both — without them a valid coupon previews with a null amount, which reads as "no discount".
 */
export function useValidateCoupon() {
  return useMutation({
    mutationFn: (input: { code: string; tier?: PlanTier; interval?: BillingInterval }) =>
      monetizationApi.validateCoupon(input),
  });
}
