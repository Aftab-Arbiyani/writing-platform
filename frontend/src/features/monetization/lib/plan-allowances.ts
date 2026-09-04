import {
  AI_QUOTA_RULES,
  DEFAULT_PLAN_FEATURES,
  PLAN_TIER_ORDER,
  QuotaWindow,
  resolvePlanLimit,
} from '@qalam/shared';
import type { PlanDefinition, PlanTier } from '@qalam/shared';

/**
 * What one plan grants, per tool — the lines a plan card shows instead of a credit balance (D5).
 *
 * **Derived from `AI_QUOTA_RULES`, not from a list here.** That array is the single definition of
 * which allowance governs which tools, and it is what the server enforces against. A second list in
 * the UI would be a copy to keep in step, and the failure mode is silent: a new allowance key would
 * ship enforced and invisible, so writers would hit a wall the pricing page never mentioned.
 *
 * Only the D5 allowance keys appear. `PlanLimits` also carries `maxPieces`, `maxCollaborators` and
 * `maxSnapshotHistory`, which belong to other features and to other rows of this card.
 */
export function planAllowanceLines(plan: PlanDefinition): string[] {
  return AI_QUOTA_RULES.map((rule) => {
    const limit = resolvePlanLimit(plan.limits, rule.limitKey);
    const period = rule.window === QuotaWindow.Monthly ? 'month' : 'day';
    // `0` is unlimited under the ordinary sentinel — read through `resolvePlanLimit` rather than
    // compared, because reading `limits[key]` directly is what turns "unlimited" into "none".
    return limit.unlimited
      ? `Unlimited ${rule.label.toLowerCase()}`
      : `${String(limit.value)} ${rule.label.toLowerCase()} a ${period}`;
  });
}

/**
 * The cheapest tier that includes a premium code, labelled — "Plus", "Pro" — or null when no tier
 * grants it.
 *
 * D5's lock copy names the tier because "a paid plan" leaves the writer to go and find out which
 * one, and the answer is already compiled in. Derived from `DEFAULT_PLAN_FEATURES` rather than
 * written down, so a code that moves between tiers moves this sentence with it.
 *
 * Null is a real answer, not a failure: five of the eight premium codes are in no tier's default
 * set at all. A caller falls back to the generic "a paid plan" rather than inventing a tier.
 */
export function firstTierIncluding(code: string): PlanTier | null {
  return (
    PLAN_TIER_ORDER.find((tier) =>
      (DEFAULT_PLAN_FEATURES[tier] as readonly string[]).includes(code),
    ) ?? null
  );
}
