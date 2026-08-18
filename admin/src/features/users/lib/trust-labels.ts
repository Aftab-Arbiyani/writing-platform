import {
  RestrictionScope,
  RestrictionType,
  StrikeSeverity,
  STRIKE_WEIGHTS,
  TrustLevel,
  TrustStatus,
  UserStatus,
} from '@qalam/shared';
import type { QTagColor } from '@qalam/ui';

/**
 * Human labels for the trust vocabulary on the ADMIN side (AF6, row A2).
 *
 * **Every string an end user can also see is copied verbatim** from the two customer clients —
 * `frontend/src/features/collaboration/lib/publishing-labels.ts` and mobile's
 * `lib/features/collaboration/presentation/domain_labels.dart` (which already agree with each
 * other). An operator and the writer they are talking to must describe the same restriction with
 * the same word; a support ticket where one says "shadow-restricted" and the other reads
 * "hidden" is the failure this duplication prevents. There is no cross-app import to reach for —
 * `@qalam/shared` is a contract package and carries no copy — so the maps are duplicated
 * deliberately and pinned by a test against the enum sets.
 *
 * Every lookup falls back to the raw wire value: these catalogues are stored as `varchar`, so a
 * value the server adds later renders as itself rather than vanishing.
 */

const TRUST_STATUS: Record<string, { label: string; color: QTagColor }> = {
  [TrustStatus.Trusted]: { label: 'Trusted', color: 'success' },
  [TrustStatus.Normal]: { label: 'Good standing', color: 'success' },
  [TrustStatus.Limited]: { label: 'Limited', color: 'warning' },
  [TrustStatus.ReadOnly]: { label: 'Read only', color: 'warning' },
  [TrustStatus.Muted]: { label: 'Muted', color: 'warning' },
  [TrustStatus.Shadowed]: { label: 'Restricted', color: 'warning' },
  [TrustStatus.Suspended]: { label: 'Suspended', color: 'danger' },
  [TrustStatus.Banned]: { label: 'Banned', color: 'danger' },
};

/** The effective status the Policy Engine sees — the clients call this field "Standing". */
export function trustStatusTag(status: string): { label: string; color: QTagColor } {
  return TRUST_STATUS[status] ?? { label: status, color: 'neutral' };
}

/**
 * The ACCOUNT's status, in the terms that keep it apart from the trust standing above (B9, A2-1).
 *
 * These two were disjoint in both directions before B9: a trust suspension left sign-in working,
 * and an account suspension was invisible to the Policy Engine — so the Trust tab rendered "Good
 * standing" for an account that had been closed. The engine now reads `users.status`, and this is
 * the display half: each description says what the state DOES, so an operator never has to infer
 * which of the two sanctions they are looking at from the word "suspended" alone.
 *
 * Only the non-active states are described. An active account needs no note, and a row that appears
 * only when something is wrong is a row that gets read.
 */
const ACCOUNT_STATUS: Record<string, { label: string; color: QTagColor; description: string }> = {
  [UserStatus.Suspended]: {
    label: 'Suspended',
    color: 'danger',
    description:
      'The ACCOUNT is suspended: they cannot sign in, their sessions were revoked, and the Policy Engine refuses every action they could still reach. That is separate from the trust standing shown here, which a suspension does not change — lift it from the account actions, not from this tab.',
  },
  [UserStatus.Deactivated]: {
    label: 'Deactivated',
    color: 'warning',
    description:
      'The account is deactivated, which is normally the person’s own doing. Sign-in is refused as if the credentials were wrong, and no trust sanction is implied by it.',
  },
};

export function accountStatusNote(
  status: string,
): { label: string; color: QTagColor; description: string } | undefined {
  return ACCOUNT_STATUS[status];
}

const RESTRICTION_TYPE: Record<string, string> = {
  [RestrictionType.ReadOnly]: 'Read-only',
  [RestrictionType.Muted]: 'Muted',
  [RestrictionType.Restricted]: 'Restricted',
  [RestrictionType.Shadow]: 'Shadow-restricted',
  [RestrictionType.Suspended]: 'Suspended',
};

export function restrictionTypeLabel(type: string): string {
  return RESTRICTION_TYPE[type] ?? type;
}

const RESTRICTION_SCOPE: Record<string, string> = {
  [RestrictionScope.Global]: 'Everywhere',
  [RestrictionScope.Publishing]: 'Publishing',
  [RestrictionScope.Collaboration]: 'Collaboration',
  [RestrictionScope.Comments]: 'Comments',
  [RestrictionScope.Reporting]: 'Reporting',
};

/** What a restriction covers — a comments-scoped mute and a global one are different sentences. */
export function restrictionScopeLabel(scope: string): string {
  return RESTRICTION_SCOPE[scope] ?? scope;
}

/**
 * What each restriction type actually stops, in the operator's terms.
 *
 * Sourced from `trustStatusForRestriction` and the Policy Engine's trust rule (`policy.rules.ts`
 * rule 1), not from the enum's name: `muted` in particular blocks exactly two actions
 * (`MUTED_SENSITIVE_ACTIONS` = story.comment, story.suggest) and nothing else, and `restricted`
 * blocks only writes whose scope the restriction covers.
 */
const RESTRICTION_EFFECT: Record<string, string> = {
  [RestrictionType.ReadOnly]: 'Reads are unaffected; every write is refused.',
  [RestrictionType.Muted]: 'Cannot comment or suggest. Other writes are unaffected.',
  [RestrictionType.Restricted]: 'Writes covered by the scope below are refused.',
  [RestrictionType.Shadow]: 'Writes appear to succeed but are visible only to them.',
  [RestrictionType.Suspended]:
    'Every action the Policy Engine gates is refused. They can still sign in.',
};

export function restrictionEffect(type: string): string | undefined {
  return RESTRICTION_EFFECT[type];
}

const TRUST_LEVEL: Record<string, string> = {
  [TrustLevel.New]: 'New',
  [TrustLevel.Basic]: 'Basic',
  [TrustLevel.Member]: 'Member',
  [TrustLevel.Trusted]: 'Trusted',
};

/**
 * The reputation tier. **Neither customer client renders this**, nor `score`, nor the strike
 * weight — they are operator-only fields, so there is no established wording to inherit and these
 * are the enum's own words rather than invented synonyms.
 */
export function trustLevelLabel(level: string): string {
  return TRUST_LEVEL[level] ?? level;
}

const STRIKE_SEVERITY: Record<string, string> = {
  [StrikeSeverity.Minor]: 'Minor',
  [StrikeSeverity.Moderate]: 'Moderate',
  [StrikeSeverity.Severe]: 'Severe',
};

/** Severity, with the weight it contributes — the weight is the number that drives escalation. */
export function strikeSeverityLabel(severity: string): string {
  const label = STRIKE_SEVERITY[severity] ?? severity;
  const weight = STRIKE_WEIGHTS[severity as StrikeSeverity];
  return weight === undefined ? label : `${label} — weight ${weight}`;
}
