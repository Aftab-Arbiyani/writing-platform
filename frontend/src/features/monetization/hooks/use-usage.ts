import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { monetizationApi } from '../api/monetization.api';
import { isMonetizationEnabled } from '../lib/monetization-enabled';
import type { UsageWindowResponse } from '../types/monetization.types';

/**
 * AI usage rollups (AF5, W4).
 *
 * **30 seconds — the Live tier** (docs/12 §2.2), because unlike a plan or a subscription this number
 * moves while the reader watches: every AI request meters through the `AI_USAGE_METER` hook, so a
 * writer who runs the assistant and then opens this dashboard must see the request they just made.
 */
const USAGE_STALE = 30 * 1000;

export function useMonetizationUsage() {
  return useQuery({
    queryKey: qk.monetization.usage(),
    queryFn: ({ signal }) => monetizationApi.usage(signal),
    enabled: isMonetizationEnabled(),
    staleTime: USAGE_STALE,
  });
}

/**
 * Whether a window has no cap at all.
 *
 * A null `tokenLimit` is the contract's "unlimited" — the enterprise tier sets its plan limits to 0,
 * which the server maps to null, and the lifetime window is unlimited by definition. `usedFraction`
 * is null in the same breath, so anything drawing a progress bar has to ask this first rather than
 * treating a missing fraction as zero (which would draw an empty bar for a limitless window).
 */
export function isUnlimited(window: UsageWindowResponse): boolean {
  return window.tokenLimit === null;
}

/**
 * Tokens left in a window, or `null` when it is unlimited.
 *
 * Clamped at zero because usage is recorded *after* a generation completes, so the request that
 * exhausts an allowance can carry it past its own limit — a negative "remaining" is arithmetic, not
 * information.
 */
export function remainingTokens(window: UsageWindowResponse): number | null {
  if (window.tokenLimit === null) return null;
  return Math.max(0, window.tokenLimit - window.tokens);
}

/**
 * Whether a window's allowance is spent.
 *
 * The same rule `features/ai`'s `ai-availability.ts` applies to `GET /ai/usage/me`: a window is
 * exhausted when it has a cap and has reached it. Stated here against the monetization payload so the
 * two dashboards agree about what "out of allowance" means.
 */
export function isExhausted(window: UsageWindowResponse): boolean {
  return window.tokenLimit !== null && (window.usedFraction ?? 0) >= 1;
}
