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
 *
 * The usage gate is computed from `GET /ai/usage/me` **before** a request, so the writer is told
 * up front instead of composing an instruction and losing it to a rejection. The same states are
 * reachable reactively from a failed request — see {@link availabilityFromErrorCode}.
 */
export type AiAvailability = 'available' | 'off' | 'feature-off' | 'quota' | 'unknown';

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
 */
export function availabilityFromErrorCode(code: string | null): AiAvailability | null {
  switch (code) {
    case ERROR_CODES.QUOTA_EXCEEDED:
    case ERROR_CODES.AI_USAGE_LIMIT_EXCEEDED:
      return 'quota';
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
};
