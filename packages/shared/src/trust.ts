/**
 * Trust & Safety vocabulary (AF6) — reputation, strikes, and restrictions that
 * feed the Policy Engine's trust rule. The Trust Platform resolves a user's
 * {@link TrustStatus} (in `policy.ts`) from these signals; the engine consumes
 * that status and never recomputes it.
 *
 * `as const` objects + union types. Pure helpers are shared so the client's
 * trust display agrees with the server's computation.
 */
import { TrustStatus } from './policy.js';

/** Reputation tier derived from a user's trust score. */
export const TrustLevel = {
  New: 'new',
  Basic: 'basic',
  Member: 'member',
  Trusted: 'trusted',
} as const;
export type TrustLevel = (typeof TrustLevel)[keyof typeof TrustLevel];

/** How serious a policy violation is — drives the strike weight. */
export const StrikeSeverity = {
  Minor: 'minor',
  Moderate: 'moderate',
  Severe: 'severe',
} as const;
export type StrikeSeverity = (typeof StrikeSeverity)[keyof typeof StrikeSeverity];

/** Weight each severity contributes to a user's active-strike total. */
export const STRIKE_WEIGHTS: Record<StrikeSeverity, number> = {
  minor: 1,
  moderate: 2,
  severe: 4,
};

/**
 * How a user is restricted. `shadow` is a shadow-restriction (their writes
 * succeed but are visible only to themselves); `suspended` blocks all writes.
 */
export const RestrictionType = {
  ReadOnly: 'read_only',
  Muted: 'muted',
  Restricted: 'restricted',
  Shadow: 'shadow',
  Suspended: 'suspended',
} as const;
export type RestrictionType = (typeof RestrictionType)[keyof typeof RestrictionType];

/** The surface a restriction applies to. `global` covers every scope. */
export const RestrictionScope = {
  Global: 'global',
  Publishing: 'publishing',
  Collaboration: 'collaboration',
  Comments: 'comments',
  Reporting: 'reporting',
} as const;
export type RestrictionScope = (typeof RestrictionScope)[keyof typeof RestrictionScope];

// ── Scoring guardrails ──────────────────────────────────────────────────────

export const TRUST_SCORE_MIN = 0;
export const TRUST_SCORE_MAX = 100;
export const TRUST_SCORE_DEFAULT = 50;

/** Active-strike weight that auto-applies a restriction / suspension. */
export const STRIKE_RESTRICTION_THRESHOLD = 3;
export const STRIKE_SUSPENSION_THRESHOLD = 6;

/** Reputation band → tier. Pure; shared so client and server agree. */
export function trustLevelForScore(score: number): TrustLevel {
  if (score >= 80) return TrustLevel.Trusted;
  if (score >= 50) return TrustLevel.Member;
  if (score >= 25) return TrustLevel.Basic;
  return TrustLevel.New;
}

/**
 * Maps a restriction type to the trust status the engine should see while that
 * restriction is active. Pure; the single place the mapping lives.
 */
export function trustStatusForRestriction(type: RestrictionType): TrustStatus {
  switch (type) {
    case RestrictionType.ReadOnly:
      return TrustStatus.ReadOnly;
    case RestrictionType.Muted:
      return TrustStatus.Muted;
    case RestrictionType.Shadow:
      return TrustStatus.Shadowed;
    case RestrictionType.Suspended:
      return TrustStatus.Suspended;
    case RestrictionType.Restricted:
    default:
      return TrustStatus.Limited;
  }
}
