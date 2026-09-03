import { ERROR_CODES, PremiumFeature, premiumCodeForAiFeature } from '@qalam/shared';
import type { AiFeature, AiFeaturesResponse } from '@qalam/api-types';

/**
 * Whether a writing tool may be used right now, and if not, why (W2/AF2, docs/45 §4.2).
 *
 * **Why this is app-level rather than inside `features/ai`.** The gate is read from more than one
 * feature, and a feature may never import another feature (docs/26 §4). Rather than fork the copy or
 * couple the features, the pure resolver lives here. It is pure vocabulary + copy: no hooks, no api
 * calls, nothing feature-specific.
 *
 * The states, deliberately distinguished because they need different copy and different remedies:
 *
 * - **off** — the master `feature.ai.enabled` switch is down. Nothing works; say so plainly. Since
 *   D5 this also absorbs the writer's own switch (see below).
 * - **feature-off** — the platform is on but this tool's flag is down (dark-launched, or disabled
 *   for this account). A neighbouring tool may still work.
 * - **quota** — the writer has spent this tool's allowance. Normal and expected, not an error: every
 *   request meters through the `AI_USAGE_METER` hook (AF5), and D5 made the allowance a per-tool
 *   count, so running out is a thing that happens on a Tuesday.
 * - **upgrade** — the Entitlement Service denied a premium code that is not `ai_writing`.
 * - **upgrade-writing** — D3: the writer is on the free tier and the writing tools are paid. Split
 *   from **upgrade** rather than folded in because the two denials name different things and lead to
 *   different places.
 *
 * **D5 removed two states.**
 *
 * `self-off` is gone with B5's switch. It existed because "the reader turned AI off" and "an admin
 * turned it off" block identically but have opposite remedies — a real distinction, but the UI that
 * made the first one reachable was removed, and a state whose copy says "you can turn it back on in
 * settings" is a lie once there is no settings control. Both now read as **off**, whose copy blames
 * nobody. (The `AI_DISABLED_BY_USER` code still maps here: the column is inert, not deleted, and a
 * writer who flipped it before D5 must still get an honest answer rather than a generic failure.)
 *
 * `signed-out` is gone because the surfaces that needed it are public. It existed for search and
 * "More like this", where an anonymous gate read returns 401 — and a 401 outside `/auth` is a
 * terminal session failure to the api client, which clears the query cache and takes the piece the
 * reader came for with it. D5 removed the gate read from those surfaces entirely, so the state has
 * no caller; the hazard it guarded is now handled where it belongs, by not making the request
 * (`use-retrieval.ts`, `use-related-pieces.ts`).
 *
 * **Why `upgrade` is reactive only.** It cannot be resolved up front: nothing in the AI module's own
 * reads knows about entitlements. The denial is raised by the monetization meter the orchestrator
 * delegates to, and it fires at request time. Resolving it in advance would mean this feature
 * reading `GET /monetization/entitlements`, which is another feature's endpoint (docs/26 §4) — so
 * instead it is recognised from the code the failed request returns.
 */
export type AiAvailability =
  'available' | 'off' | 'feature-off' | 'quota' | 'upgrade' | 'upgrade-writing' | 'unknown';

/**
 * `feature: null` means **a surface with no feature flag and no model call** — gated by the master
 * switch and `ai.use` alone. Story Map's graph reads are the case: they carry `@Permissions(AiUse)`
 * and nothing else, and project the AF3 graph without reaching a provider.
 *
 * The skip is deliberate and follows the server. Picking a *neighbouring* feature's flag would hide
 * a surface the server would have served — the mistake mobile's editor calls out by name
 * (`editor_screen.dart:241-244`). So a null feature can never resolve to `feature-off`.
 *
 * **D5 removed the pre-flight quota gate.** It read `GET /ai/usage/me` and resolved `quota` from a
 * token-window rollup; that route is gone (B2) and tokens are no longer the writer's unit anyway.
 * The allowance is a per-tool count, and the only authority on it is the 429 the request returns —
 * which {@link availabilityFromErrorCode} already handled, and which was always the authoritative
 * half. What is lost is telling the writer *before* they click; what is gained is never telling them
 * something false, which the old read could do the moment the rollup went stale.
 */
export function resolveAvailability(args: {
  feature: AiFeature | null;
  features: AiFeaturesResponse | undefined;
}): AiAvailability {
  const { feature, features } = args;
  // Nothing loaded yet — 'unknown' keeps the panel quiet rather than flashing a wall.
  if (!features) return 'unknown';
  if (!features.aiEnabled) return 'off';
  if (feature === null) return 'available';

  const flag = features.features.find((entry) => entry.feature === feature);
  if (flag && !flag.enabled) return 'feature-off';

  return 'available';
}

/**
 * Map a failed request's error code onto the same vocabulary, so a wall hit mid-flight renders
 * identically to one detected up front. `QUOTA_EXCEEDED` is the plan's per-tool allowance and
 * `AI_USAGE_LIMIT_EXCEEDED` the platform's own token cap — indistinguishable to a writer, who only
 * needs to know they are out.
 *
 * **`ENTITLEMENT_DENIED` was unmapped until W4**, and an unmapped code returns null, which resolves
 * to the pre-flight answer — "available" — so a writer refused saw a generic failure and a panel
 * that still invited them to try again.
 */
export function availabilityFromErrorCode(
  code: string | null,
  feature?: AiFeature | null,
): AiAvailability | null {
  switch (code) {
    case ERROR_CODES.QUOTA_EXCEEDED:
    case ERROR_CODES.AI_USAGE_LIMIT_EXCEEDED:
      return 'quota';
    /**
     * D3 splits this by WHICH code was denied, and it reads the same map the server gated on
     * (`AI_FEATURE_PREMIUM_CODE`) rather than the 402's `details` — the surface already knows
     * its own feature, so the answer needs no extra plumbing through the stream store and
     * cannot drift from the server's decision.
     */
    case ERROR_CODES.ENTITLEMENT_DENIED:
      return feature != null && premiumCodeForAiFeature(feature) === PremiumFeature.AiWriting
        ? 'upgrade-writing'
        : 'upgrade';
    case ERROR_CODES.AI_DISABLED:
      return 'off';
    /**
     * B5's code. It no longer gets its own state: D5 removed the switch that produced it, so there
     * is no remedy to name and "you turned this off" would point at a control that does not exist.
     * Still mapped rather than dropped, because the column is inert, not deleted — a writer who
     * flipped it before D5 would otherwise get an unmapped code, which resolves to "available" and
     * invites them to retry forever.
     */
    case ERROR_CODES.AI_DISABLED_BY_USER:
      return 'off';
    case ERROR_CODES.AI_FEATURE_DISABLED:
      return 'feature-off';
    default:
      return null;
  }
}

/**
 * Copy for each blocked state. `available`/`unknown` never render a notice.
 *
 * **No occurrence of "AI" anywhere in here** (D5 decision 9). The writer reads these at the moment
 * something is refused, which is the worst possible place to introduce a word the product does not
 * otherwise use about itself.
 */
export const AVAILABILITY_COPY: Record<
  Exclude<AiAvailability, 'available' | 'unknown'>,
  { title: string; description: string }
> = {
  // Covers both the platform switch and a pre-D5 writer's own inert one. Blames nobody and promises
  // nothing, because from here the two are indistinguishable and neither has an action.
  off: {
    title: 'Writing tools aren’t available',
    description: 'These tools aren’t enabled on this instance. Your writing is unaffected.',
  },
  'feature-off': {
    title: 'Not available yet',
    description: 'This tool isn’t enabled for your account.',
  },
  quota: {
    title: 'You’ve used this tool’s allowance',
    description:
      'Your allowance resets at the start of the next period. Your writing is unaffected.',
  },
  // The only blocked state with an action attached, because it is the only one the writer can
  // resolve themselves. The others are waiting or an admin; this one is a plan.
  upgrade: {
    title: 'This needs a paid plan',
    description:
      'Your plan doesn’t include this tool. Your writing is unaffected — everything else works as usual.',
  },
  // D3. Names the tier because "a paid plan" leaves the writer to go and find out which one.
  'upgrade-writing': {
    title: 'Polish & feedback is on Plus and above',
    description:
      'Your plan doesn’t include these tools. Your drafts are unaffected — the editor and search work as usual.',
  },
};
