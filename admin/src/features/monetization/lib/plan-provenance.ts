import {
  DEFAULT_PLAN_FEATURES,
  DEFAULT_PLAN_LIMITS,
  NEGATIVE_UNLIMITED_LIMIT_KEYS,
  UNLIMITED_SEATS,
  resolvePlanLimit,
  type PlanLimits,
  type PlanTier,
  type PremiumFeature,
} from '@qalam/shared';

/**
 * Reading the plan catalogue honestly (A1a) — pure, so the rules are testable without a DOM.
 *
 * Two problems this file exists to solve, both of which a naive table gets wrong:
 *
 * 1. **`GET /admin/monetization/plans` returns the RESOLVED catalogue and no provenance.** The
 *    server folds the stored `monetization.plans` setting over the compiled defaults and hands back
 *    one merged object, so nothing on the wire says which numbers an administrator chose and which
 *    are simply what the code ships. An operator about to change a cap needs that distinction, so it
 *    is derived here by comparing the resolved value against `DEFAULT_PLAN_*` from `@qalam/shared` —
 *    the same constants the server compiled from. Derived, therefore inferred: see
 *    {@link featureProvenance} for where that inference is weaker and why.
 * 2. **The two sentinel conventions.** `0` means unlimited for every limit key except
 *    `maxCollaborators`, where `-1` means unlimited and `0` means NONE. Rendering one convention
 *    across all keys would read Free's genuine zero seats as "unlimited collaborators" — the exact
 *    inverse of what B6 sells. Nothing here re-implements that reading: {@link describeLimit}
 *    delegates to `resolvePlanLimit`, the shared reader that is the single place the conventions are
 *    reconciled.
 */

/** Where a resolved value came from, as far as the wire allows us to tell. */
export type Provenance = 'default' | 'override';

export interface LimitReading {
  key: string;
  /** The number as stored/resolved. */
  value: number;
  /** True when the plan sets no cap, under the convention that governs this key. */
  unlimited: boolean;
  /** True when `-1` is this key's unlimited sentinel and `0` is a hard zero. */
  inverted: boolean;
  /** What the compiled catalogue ships for this tier+key, or undefined if it ships nothing. */
  defaultValue: number | undefined;
  provenance: Provenance;
  /** Operator-facing rendering of {@link value} under this key's convention. */
  display: string;
}

/**
 * The limit keys shown for every tier, in a fixed order.
 *
 * Taken from the COMPILED defaults rather than from the resolved response, so a key an admin deleted
 * from a stored tier still appears (as a default) instead of silently vanishing from the screen.
 */
export function limitKeysFor(tier: PlanTier): string[] {
  return Object.keys(DEFAULT_PLAN_LIMITS[tier]);
}

/**
 * Read one limit under its own convention, with its provenance.
 *
 * `display` is the whole point: the same number renders differently depending on the key, and an
 * operator must never have to remember which. `0` on `maxPieces` reads "Unlimited"; `0` on
 * `maxCollaborators` reads "None (0)". The parenthetical number is kept on the inverted key so the
 * stored value stays visible — an operator editing the JSON needs to know what is actually in it.
 */
export function describeLimit(
  tier: PlanTier,
  // `Partial`, matching what `resolvePlanLimit` accepts: a stored tier may omit a key entirely, and
  // an omission has to be readable rather than a type error at the call site.
  limits: Partial<PlanLimits> | undefined,
  key: string,
): LimitReading {
  const { value, unlimited } = resolvePlanLimit(limits, key);
  const inverted = NEGATIVE_UNLIMITED_LIMIT_KEYS.includes(key);
  const defaultValue = (DEFAULT_PLAN_LIMITS[tier] as Record<string, number | undefined>)[key];

  return {
    key,
    value,
    unlimited,
    inverted,
    defaultValue,
    provenance: defaultValue === undefined || value !== defaultValue ? 'override' : 'default',
    display: renderLimit(value, unlimited, inverted),
  };
}

function renderLimit(value: number, unlimited: boolean, inverted: boolean): string {
  if (unlimited) {
    return inverted ? `Unlimited (${String(value)})` : 'Unlimited';
  }
  // The inverted key's hard zero. Naming it "None" rather than printing a bare 0 is the difference
  // between an operator reading Free as "no collaboration" and reading it as "no limit".
  if (inverted && value === 0) {
    return 'None (0)';
  }
  return value.toLocaleString();
}

/**
 * A one-line statement of the convention governing a key, for rendering AT the field.
 *
 * Inline and unconditional, not a tooltip: the inverted sentinel is the single most misreadable
 * thing on this screen, and a convention an operator has to hover to discover is a convention they
 * will act without. Returns a sentence for every key so the ordinary ones state their rule too —
 * otherwise the absence of a note on `maxPieces` reads as "no convention here".
 */
export function sentinelNote(key: string): string {
  if (NEGATIVE_UNLIMITED_LIMIT_KEYS.includes(key)) {
    return `Inverted sentinel: ${String(UNLIMITED_SEATS)} = unlimited, 0 = none. This key is the exception.`;
  }
  return '0 = unlimited.';
}

/**
 * Whether a tier's granted feature codes differ from the compiled defaults.
 *
 * **Weaker than {@link describeLimit} on purpose, and the reason is in the merge.** `mergePlans`
 * merges `limits` per key but spreads the rest of a stored tier wholesale, so a stored `features`
 * array REPLACES the compiled one rather than combining with it. There is therefore no per-code
 * provenance to report — a code is not individually "overridden", the whole array either came from
 * the admin or from the compiled default. So this answers at array granularity and the UI says so,
 * rather than decorating individual codes with a precision the wire cannot support.
 */
export function featureProvenance(tier: PlanTier, features: readonly PremiumFeature[]): Provenance {
  const compiled = DEFAULT_PLAN_FEATURES[tier];
  if (features.length !== compiled.length) {
    return 'override';
  }
  const shipped = new Set<string>(compiled);
  return features.every((code) => shipped.has(code)) ? 'default' : 'override';
}

/** Codes this tier grants that the compiled catalogue does not, and vice versa. */
export function featureDelta(
  tier: PlanTier,
  features: readonly PremiumFeature[],
): { added: string[]; removed: string[] } {
  const compiled = new Set<string>(DEFAULT_PLAN_FEATURES[tier]);
  const granted = new Set<string>(features);
  return {
    added: [...granted].filter((code) => !compiled.has(code)).sort(),
    removed: [...compiled].filter((code) => !granted.has(code)).sort(),
  };
}

/**
 * Whether a premium code is actually ENFORCED by a server route today, which decides whether
 * granting it changes anything.
 *
 * Exactly two are: `ai_budget` (the usage meter asserts it on every AI request) and `ai_writing`
 * (D3, enforced 2026-08-17 — same meter, per-feature). The remaining six are computed by the
 * Entitlement Service and asserted by nothing, which is D4's deferred scope (docs/48 §5.2
 * consequence 1). An operator granting one of those six should know it will have no effect, because
 * the alternative is a support ticket about a grant that "didn't work".
 */
const ENFORCED_CODES = new Set<string>(['ai_budget', 'ai_writing']);

export function isEnforcedCode(code: string): boolean {
  return ENFORCED_CODES.has(code);
}
