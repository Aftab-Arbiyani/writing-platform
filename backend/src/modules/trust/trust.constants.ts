/**
 * Trust & Safety audit vocabulary (AF6) — dot-cased `trust.verb` action codes
 * recorded in `audit_logs` via `AuditService.record()` (the shared trail, reused
 * from E12.5). `auditCategoryOf` buckets these as "administrative", which is
 * correct. Kept here so the service and its spec share one source of truth.
 */
export const TRUST_AUDIT_ACTIONS = {
  StrikeIssue: 'trust.strike_issue',
  StrikeRevoke: 'trust.strike_revoke',
  RestrictionApply: 'trust.restriction_apply',
  RestrictionLift: 'trust.restriction_lift',
  UserBlock: 'trust.block',
  UserMute: 'trust.mute',
} as const;

/** Audit target types owned by the Trust module. */
export const TRUST_AUDIT_TARGET = {
  User: 'user',
  Restriction: 'restriction',
} as const;

/**
 * The two personal-relationship edge kinds. A `block` severs interaction both
 * ways (feeds the Policy Engine's interaction-blocked check); a `mute` only
 * hides the target from the muter and never crosses into policy.
 */
export const BLOCK_KIND = {
  Block: 'block',
  Mute: 'mute',
} as const;

export type BlockKind = (typeof BLOCK_KIND)[keyof typeof BLOCK_KIND];
