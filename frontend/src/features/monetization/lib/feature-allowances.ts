import { QuotaWindow } from '@qalam/shared';

import type { FeatureQuotaResponse } from '../types/monetization.types';

/** One tool's allowance, normalized for rendering. */
export interface FeatureAllowance {
  key: string;
  label: string;
  window: QuotaWindow;
  used: number;
  /** `null` means no limit — never 0, which is the wire's sentinel FOR unlimited. */
  limit: number | null;
  remaining: number | null;
  resetsAt: string | null;
}

/**
 * Normalize the server's allowances (D5).
 *
 * **The one job here is that `limit` reaches the UI as `null` or a real number, never 0.** Across
 * `PlanLimits`, `0` means unlimited — the ordinary sentinel this platform uses everywhere except
 * `maxCollaborators`. A component that took the raw number would render "12 of 0", or divide by it
 * to draw a progress bar, and an enterprise plan's generosity would display as a spent allowance.
 * The server already resolves this into `unlimited` + a null `limit`; this makes the guarantee
 * total, because a stale or hand-written payload can disagree with itself.
 *
 * Tolerant of a server that has not shipped D5's `quotas` yet: an absent array is no allowances,
 * which renders as an empty state rather than a crash.
 */
export function normalizeAllowances(raw: readonly FeatureQuotaResponse[] | undefined | null) {
  return (raw ?? []).map((quota): FeatureAllowance => {
    const limit = quota.unlimited || quota.limit === null || quota.limit <= 0 ? null : quota.limit;
    return {
      key: quota.limitKey,
      label: quota.label,
      window: quota.window,
      used: Math.max(0, quota.used),
      limit,
      // Recomputed rather than trusted: `remaining` and `limit` are two numbers that can disagree,
      // and the one a reader sees should follow from the one drawn on the bar.
      remaining: limit === null ? null : Math.max(0, limit - quota.used),
      resetsAt: quota.resetsAt,
    };
  });
}

/** "12 of 30 today" / "Unlimited" — the whole of what a writer needs to read. */
export function allowanceLine(allowance: FeatureAllowance): string {
  if (allowance.limit === null) return 'Unlimited';
  return `${allowance.used} of ${allowance.limit} ${windowNoun(allowance.window)}`;
}

/** The window as it reads at the end of a sentence, not as an enum value. */
export function windowNoun(window: QuotaWindow): string {
  return window === QuotaWindow.Monthly ? 'this month' : 'today';
}

/** The allowance for one limit key, or null when the server did not report it. */
export function allowanceFor(
  allowances: readonly FeatureAllowance[],
  key: string,
): FeatureAllowance | null {
  return allowances.find((a) => a.key === key) ?? null;
}
