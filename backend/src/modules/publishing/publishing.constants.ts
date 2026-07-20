/**
 * Publishing module constants (AF6) — the module-local vocabulary: the audit
 * action/target strings it records. Kept local (not in the shared error/
 * permission catalogues) exactly like `monetization.constants.ts` and
 * `policy.constants.ts`.
 */

/** Audit-log `action` strings for publishing mutations (dot-cased target.verb). */
export const PUBLISHING_AUDIT_ACTIONS = {
  Published: 'publication.publish',
  Unpublished: 'publication.unpublish',
  Scheduled: 'publication.schedule',
  VisibilityChanged: 'publication.change_visibility',
  Reverted: 'publication.revert',
  ReviewRequested: 'review.request',
  ReviewApproved: 'review.approve',
  ChangesRequested: 'review.request_changes',
  SnapshotCreated: 'snapshot.create',
} as const;

/** Audit-log `targetType` strings for publishing entities. */
export const PUBLISHING_AUDIT_TARGET = {
  Story: 'story',
  Review: 'review',
  Snapshot: 'snapshot',
} as const;
