import type {
  RevenueAnalytics,
  SubscriptionAnalytics,
  UsageAnalytics,
} from '../types/monetization.types';

/**
 * Telling "there is no data" apart from "the number is genuinely zero" (A1c).
 *
 * All three analytics endpoints compute on read from append-only ledgers, so a young install gets a
 * complete, well-formed response full of zeroes. Rendering that as `$0.00 revenue` and `0 active
 * subscriptions` is the defect W7c already recorded against the reader stats page: a fabricated zero
 * reads as a measurement, and an operator cannot tell it apart from a real collapse in revenue.
 *
 * So each dashboard gets an emptiness predicate derived from the field that can only be zero when
 * nothing has happened at all — a COUNT, never a SUM. A sum of zero is ambiguous (no payments, or
 * payments that netted nothing); a count of zero is not.
 *
 * - **Revenue** — `paymentsCount` is the number of succeeded payment rows. Zero rows means there is
 *   nothing to total, so the totals are absent rather than zero.
 * - **Subscriptions** — `byStatus` is a GROUP BY over the subscriptions table, so an empty object
 *   means no subscription has ever existed. `activeCount: 0` alone would not prove that: an install
 *   with only cancelled subscriptions has real data and no active ones, and that is worth showing.
 * - **Usage** — no ledger rows attributed to AI usage. `byFeature` is the same GROUP BY shape, and
 *   `totalTokens` is checked with it because a provider that reported no token counts would still
 *   have produced feature rows worth displaying.
 */
export function revenueIsEmpty(revenue: RevenueAnalytics): boolean {
  return revenue.paymentsCount === 0;
}

export function subscriptionsAreEmpty(subscriptions: SubscriptionAnalytics): boolean {
  return Object.keys(subscriptions.byStatus).length === 0;
}

export function usageIsEmpty(usage: UsageAnalytics): boolean {
  return usage.byFeature.length === 0 && usage.totalTokens === 0;
}

/**
 * The copy each empty dashboard shows. Says what is absent and why that is expected on a young
 * install, so an operator reads "nothing has happened yet" rather than "this screen is broken".
 */
export const EMPTY_COPY = {
  revenue: {
    title: 'No payments recorded yet',
    description:
      'Revenue is totalled from succeeded payments, and this install has none. Figures appear once the first payment settles.',
  },
  subscriptions: {
    title: 'No subscriptions yet',
    description:
      'Nobody has subscribed on this install, so there is no status or tier breakdown to show.',
  },
  usage: {
    title: 'No AI usage recorded yet',
    description:
      'Usage and cost are totalled from the credit ledger. Figures appear once AI requests start metering.',
  },
} as const;
