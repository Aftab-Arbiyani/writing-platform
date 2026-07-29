import { EntitlementReason, EntitlementStatus, PlanTier, planRank } from '@qalam/shared';

import type {
  EntitlementDecision,
  EntitlementSnapshot,
  PremiumFeature,
} from '../types/monetization.types';

/**
 * Pure readers over an entitlement snapshot (AF5, W4).
 *
 * Mobile carries these as methods on its `EntitlementSnapshot` class; web's wire types are plain
 * interfaces straight off `@qalam/api-types`, so the behaviour lives here as functions instead of
 * being re-implemented at each call site. Nothing in this file decides anything — it reads what the
 * server already decided.
 */

/**
 * The decision for a feature, **denying by default when the snapshot doesn't mention it**.
 *
 * A missing feature is the normal free-tier shape, not a gap: the server lists the catalogued
 * features it evaluated, and an unlisted one has no grant. Synthesising a deny keeps every caller on
 * one code path and makes the absent case fail closed.
 */
export function decisionFor(
  snapshot: EntitlementSnapshot | undefined,
  feature: PremiumFeature | string,
): EntitlementDecision {
  const found = snapshot?.features.find((entry) => entry.feature === feature);
  return (
    found ?? {
      feature: feature as PremiumFeature,
      status: EntitlementStatus.Deny,
      allowed: false,
      reason: EntitlementReason.PlanExcludes,
      expiresAt: null,
      remaining: null,
      limit: null,
    }
  );
}

/**
 * Whether the viewer may use a premium feature — the single question a gate asks.
 *
 * Reads the server's own `allowed` boolean and never re-derives it from `status`. The two agree
 * today (`allow`/`limited`/`trial`/`grace_period` are the access-granting statuses), but the server
 * computes `allowed` from plan + overrides + time boundaries + quota, and re-deriving it client-side
 * would be a second implementation of that logic waiting to disagree with the first.
 */
export function allows(
  snapshot: EntitlementSnapshot | undefined,
  feature: PremiumFeature | string,
): boolean {
  return decisionFor(snapshot, feature).allowed;
}

/** Whether the viewer is on any paid tier. Used for badges and copy, never as a gate. */
export function isPremium(snapshot: EntitlementSnapshot | undefined): boolean {
  return planRank(snapshot?.tier ?? PlanTier.Free) > planRank(PlanTier.Free);
}

/**
 * Whether a decision is time-bounded — a trial or a grace period.
 *
 * Worth distinguishing from a plain allow because the copy differs: access that ends on a date
 * deserves to say so before it ends, not after.
 */
export function isTimeBounded(decision: EntitlementDecision): boolean {
  return (
    decision.status === EntitlementStatus.Trial || decision.status === EntitlementStatus.GracePeriod
  );
}

/**
 * Whether a denial is a spent allowance rather than a missing plan.
 *
 * The difference is the whole remedy: `quota_exceeded` resets on its own and upgrading is optional;
 * `plan_excludes` never resets and upgrading is the only path. A gate that offers "See plans" to
 * someone who simply needs to wait until tomorrow is misleading them into a purchase.
 */
export function isQuotaDenial(decision: EntitlementDecision): boolean {
  return decision.reason === EntitlementReason.QuotaExceeded;
}
