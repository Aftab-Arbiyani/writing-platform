import {
  PublicationEvent,
  RestrictionScope,
  RestrictionType,
  ReviewState,
  SnapshotReason,
  TrustStatus,
  Visibility,
} from '@qalam/shared';
import type { QTagColor } from '@qalam/ui';

/**
 * Human labels for the publishing + trust vocabulary (AF6, W3c) — presentation only, ported from
 * mobile's `domain_labels.dart` so both clients name the same state the same way.
 *
 * Every lookup falls back to the raw wire value. These catalogues are open (stored as `varchar`, and
 * `PublicationEvent` says so explicitly), so a value the server adds later must render as itself
 * rather than vanish — an unknown label is debuggable, a dropped one is not.
 */

const REVIEW_STATE: Record<string, { label: string; color: QTagColor }> = {
  [ReviewState.Draft]: { label: 'Draft', color: 'neutral' },
  [ReviewState.InReview]: { label: 'In review', color: 'info' },
  [ReviewState.ChangesRequested]: { label: 'Changes requested', color: 'warning' },
  [ReviewState.Approved]: { label: 'Approved', color: 'success' },
  [ReviewState.Published]: { label: 'Published', color: 'success' },
};

/** A review state as a label + tag colour. `null` (no session) is the Draft state (defect P-4). */
export function reviewStateTag(state: string | null | undefined): {
  label: string;
  color: QTagColor;
} {
  const key = state ?? ReviewState.Draft;
  return REVIEW_STATE[key] ?? { label: key, color: 'neutral' };
}

const VISIBILITY: Record<string, string> = {
  [Visibility.Private]: 'Private',
  [Visibility.Unlisted]: 'Unlisted',
  [Visibility.Public]: 'Public',
};

/**
 * The complete set the server accepts (`ChangeVisibilityDto` is `@IsIn(Object.values(Visibility))`),
 * in ascending order of reach.
 *
 * There is **no `followers`**. Mobile listed one and rendered a chip per entry, so tapping
 * "Followers" sent a value the enum does not contain and got `400 VALIDATION_FAILED` (defect P-3);
 * followers-only is a *profile* privacy setting, not a piece visibility.
 */
export const VISIBILITY_OPTIONS: readonly Visibility[] = [
  Visibility.Private,
  Visibility.Unlisted,
  Visibility.Public,
];

export function visibilityLabel(visibility: string): string {
  return VISIBILITY[visibility] ?? visibility;
}

const SNAPSHOT_REASON: Record<string, string> = {
  [SnapshotReason.Publish]: 'On publish',
  [SnapshotReason.Manual]: 'Manual',
  [SnapshotReason.PreEdit]: 'Before edit',
  [SnapshotReason.Review]: 'For review',
  [SnapshotReason.Restore]: 'Restore point',
};

/** Why a version exists — a real wire field, and the only description a snapshot has. */
export function snapshotReasonLabel(reason: string): string {
  return SNAPSHOT_REASON[reason] ?? reason;
}

const PUBLICATION_EVENT: Record<string, string> = {
  [PublicationEvent.Submitted]: 'Submitted for review',
  [PublicationEvent.ReviewApproved]: 'Review approved',
  [PublicationEvent.ChangesRequested]: 'Changes requested',
  [PublicationEvent.Rejected]: 'Rejected',
  [PublicationEvent.Published]: 'Published',
  [PublicationEvent.Scheduled]: 'Scheduled',
  [PublicationEvent.Unpublished]: 'Unpublished',
  [PublicationEvent.VisibilityChanged]: 'Visibility changed',
  [PublicationEvent.SnapshotCreated]: 'Snapshot captured',
  [PublicationEvent.Reverted]: 'Reverted to a snapshot',
};

export function publicationEventLabel(type: string): string {
  return PUBLICATION_EVENT[type] ?? type;
}

const TRUST_STATUS: Record<string, string> = {
  [TrustStatus.Trusted]: 'Trusted',
  [TrustStatus.Normal]: 'Good standing',
  [TrustStatus.Limited]: 'Limited',
  [TrustStatus.ReadOnly]: 'Read only',
  [TrustStatus.Muted]: 'Muted',
  [TrustStatus.Shadowed]: 'Restricted',
  [TrustStatus.Suspended]: 'Suspended',
  [TrustStatus.Banned]: 'Banned',
};

export function trustStatusLabel(status: string): string {
  return TRUST_STATUS[status] ?? status;
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

/** What a restriction covers. Mobile ignored `scope` entirely, so it could not say (defect T-2). */
export function restrictionScopeLabel(scope: string): string {
  return RESTRICTION_SCOPE[scope] ?? scope;
}
