/**
 * Feature-flag evaluation (P7.1). Turns the previously-dead `environment` and
 * `rolloutPercentage` columns on `feature_flags` into real gates, WITHOUT
 * changing behaviour for the common case: a flag scoped to `all` with
 * `rolloutPercentage: 0` (the seeded default) evaluates to exactly its
 * `enabled` value, so existing gates are untouched. Only flags an admin
 * explicitly scopes to an environment or gives a partial rollout get new
 * gating — a strict superset of the old `flag.enabled` check.
 *
 * Semantics:
 *   - `enabled = false`                     → off (always).
 *   - `environment` ∈ {all, <current-env>}  → passes the scope gate; anything
 *     else (e.g. flag scoped `production` on a `staging` node) → off.
 *   - `rolloutPercentage`: 0 or ≥100        → rollout mechanism OFF (governed by
 *     enabled+scope). 1..99 → gated by a deterministic hash of `key:subjectId`
 *     when a `subjectId` is supplied; with no subject (system-level gate) the
 *     rollout is not applicable and the flag passes on enabled+scope alone.
 */

/** Minimal flag shape the evaluator needs (a superset is fine). */
export interface EvaluableFlag {
  readonly key: string;
  readonly enabled: boolean;
  readonly environment?: string;
  readonly rolloutPercentage?: number;
}

export interface FlagEvaluationContext {
  /** Current runtime environment; defaults to NODE_ENV. */
  readonly environment?: string;
  /** Stable per-subject id (e.g. user id) for percentage rollout bucketing. */
  readonly subjectId?: string;
}

/** FNV-1a 32-bit — dependency-free, stable across processes/restarts. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Bucket 0..99 for `key:subjectId` — deterministic and evenly distributed. */
export function rolloutBucket(key: string, subjectId: string): number {
  return fnv1a(`${key}:${subjectId}`) % 100;
}

/** True when `flag` is effectively enabled for the given context. */
export function evaluateFeatureFlag(flag: EvaluableFlag, ctx: FlagEvaluationContext = {}): boolean {
  if (!flag.enabled) return false;

  const environment = ctx.environment ?? process.env.NODE_ENV ?? 'development';
  const scope = flag.environment ?? 'all';
  if (scope !== 'all' && scope !== environment) return false;

  const pct = flag.rolloutPercentage ?? 0;
  if (pct <= 0 || pct >= 100) return true; // rollout mechanism off / full
  if (ctx.subjectId === undefined) return true; // system-level gate: rollout N/A
  return rolloutBucket(flag.key, ctx.subjectId) < pct;
}
