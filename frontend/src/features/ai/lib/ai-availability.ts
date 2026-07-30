import { ERROR_CODES } from '@qalam/shared';
import type { AiFeature, AiFeaturesResponse, AiUsageResponse } from '@qalam/api-types';

/**
 * Whether an AI surface may be used right now, and if not, why (W2/AF2, docs/45 §4.2).
 *
 * Three independent gates, deliberately distinguished because they need different copy and
 * different remedies:
 *
 * - **off** — the master `feature.ai.enabled` switch is down. Nothing AI works; say so plainly.
 * - **feature-off** — AI is on but this feature's flag is down (dark-launched, or disabled for
 *   this account). Neighbouring AI surfaces may still work.
 * - **quota** — the writer has spent their daily or monthly token allowance. This is the state
 *   W2 was required to have "from day one": every AI request meters through the `AI_USAGE_METER`
 *   hook (AF5), so a quota wall is a normal, expected outcome, not an error condition.
 * - **upgrade** — the Entitlement Service denied the writer an AI budget outright (AF5/W4). Added by
 *   W4, and distinct from **quota** for the reason the remedy differs: an allowance resets on its own
 *   and waiting is enough, while a denied entitlement never resets and only a plan changes it.
 *
 * The usage gate is computed from `GET /ai/usage/me` **before** a request, so the writer is told
 * up front instead of composing an instruction and losing it to a rejection. The same states are
 * reachable reactively from a failed request — see {@link availabilityFromErrorCode}.
 *
 * **Why `upgrade` is reactive only.** It cannot be resolved up front, because nothing in the AI
 * module's own reads knows about entitlements: the denial is raised by the monetization meter that
 * the AI orchestrator delegates to, and it fires at request time. Resolving it in advance would mean
 * this feature reading `GET /monetization/entitlements`, which is another feature's endpoint
 * (docs/26 §4) — so instead it is recognised from the code the failed request returns, which is the
 * same mechanism the other three already use as their fallback.
 */
export type AiAvailability = 'available' | 'off' | 'feature-off' | 'quota' | 'upgrade' | 'unknown';

/** A window is exhausted when it has a cap and has reached it. Unlimited windows never are. */
function windowExhausted(window: {
  tokenLimit: number | null;
  usedFraction: number | null;
}): boolean {
  return window.tokenLimit !== null && (window.usedFraction ?? 0) >= 1;
}

export function resolveAvailability(args: {
  feature: AiFeature;
  features: AiFeaturesResponse | undefined;
  usage: AiUsageResponse | undefined;
}): AiAvailability {
  const { feature, features, usage } = args;
  // Nothing loaded yet — 'unknown' keeps the panel quiet rather than flashing a wall.
  if (!features) return 'unknown';
  if (!features.aiEnabled) return 'off';

  const flag = features.features.find((entry) => entry.feature === feature);
  if (flag && !flag.enabled) return 'feature-off';

  if (usage && (windowExhausted(usage.daily) || windowExhausted(usage.monthly))) return 'quota';
  return 'available';
}

/**
 * Map a failed request's error code onto the same vocabulary, so a wall hit mid-flight renders
 * identically to one detected up front. `QUOTA_EXCEEDED` is the monetization plan's cap and
 * `AI_USAGE_LIMIT_EXCEEDED` the AI module's own token cap — indistinguishable to a writer, who
 * only needs to know they are out of allowance.
 *
 * **`ENTITLEMENT_DENIED` and `INSUFFICIENT_CREDITS` were unmapped until W4**, and an unmapped code
 * returns null, which resolves to the pre-flight answer — "available" — so a writer refused for
 * either reason saw a generic failure and a panel that still invited them to try again. Both are
 * raised by the AF5 meter on the way into a generation (`AiUsageMeterService.checkQuota` asserts the
 * `ai_budget` entitlement, the only premium feature any server route actually enforces), so they are
 * the one place where monetization genuinely gates an AI surface, and they get the state whose remedy
 * is a plan.
 */
export function availabilityFromErrorCode(code: string | null): AiAvailability | null {
  switch (code) {
    case ERROR_CODES.QUOTA_EXCEEDED:
    case ERROR_CODES.AI_USAGE_LIMIT_EXCEEDED:
      return 'quota';
    case ERROR_CODES.ENTITLEMENT_DENIED:
    case ERROR_CODES.INSUFFICIENT_CREDITS:
      return 'upgrade';
    case ERROR_CODES.AI_DISABLED:
      return 'off';
    case ERROR_CODES.AI_FEATURE_DISABLED:
      return 'feature-off';
    default:
      return null;
  }
}

/** Copy for each blocked state. `available`/`unknown` never render a notice. */
export const AVAILABILITY_COPY: Record<
  Exclude<AiAvailability, 'available' | 'unknown'>,
  { title: string; description: string }
> = {
  off: {
    title: 'AI is turned off',
    description: 'AI features aren’t enabled on this instance yet.',
  },
  'feature-off': {
    title: 'Not available yet',
    description: 'This assistant isn’t enabled for your account.',
  },
  quota: {
    title: 'You’ve used your AI allowance',
    description:
      'Your allowance resets at the start of the next period. Your writing is unaffected.',
  },
  // The only blocked state with an action attached, because it is the only one the writer can resolve
  // themselves. The others are waiting or an admin; this one is a plan.
  upgrade: {
    title: 'This needs a paid plan',
    description:
      'Your plan doesn’t include an AI allowance. Your writing is unaffected — everything else works as usual.',
  },
};
