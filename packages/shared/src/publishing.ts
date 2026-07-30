/**
 * Publishing vocabulary (AF6) — the editorial review workflow, publishing
 * history, and content snapshots that layer on top of the existing piece
 * lifecycle (`PieceStatus`/`Visibility` in `enums.ts`).
 *
 * The review workflow is a SEPARATE dimension from `PieceStatus`: a piece can be
 * a draft that is `in_review`, and only an `approved` review lets a
 * review-gated story publish. Non-gated stories publish directly (unchanged
 * behaviour). `as const` objects + union types.
 */

/**
 * State of an editorial review session for one story. `changes_requested`
 * bounces back to the author; `approved` unlocks publishing.
 */
export const ReviewState = {
  Draft: 'draft',
  InReview: 'in_review',
  ChangesRequested: 'changes_requested',
  Approved: 'approved',
  Published: 'published',
} as const;
export type ReviewState = (typeof ReviewState)[keyof typeof ReviewState];

/** A reviewer's decision on a submitted story. */
export const ReviewDecision = {
  Approve: 'approve',
  RequestChanges: 'request_changes',
  Reject: 'reject',
} as const;
export type ReviewDecision = (typeof ReviewDecision)[keyof typeof ReviewDecision];

/**
 * Publishing-history event kinds — the immutable audit trail of a story's
 * publication lifecycle. Open catalogue (stored as `varchar`).
 */
export const PublicationEvent = {
  Submitted: 'submitted',
  ReviewApproved: 'review_approved',
  ChangesRequested: 'changes_requested',
  Rejected: 'rejected',
  Published: 'published',
  Scheduled: 'scheduled',
  Unpublished: 'unpublished',
  VisibilityChanged: 'visibility_changed',
  SnapshotCreated: 'snapshot_created',
  Reverted: 'reverted',
} as const;
export type PublicationEvent = (typeof PublicationEvent)[keyof typeof PublicationEvent];

/** Why a content snapshot (read-only version) was captured. */
export const SnapshotReason = {
  Publish: 'publish',
  Manual: 'manual',
  PreEdit: 'pre_edit',
  Review: 'review',
  Restore: 'restore',
} as const;
export type SnapshotReason = (typeof SnapshotReason)[keyof typeof SnapshotReason];

/** Max retained snapshots per story before the oldest manual ones are pruned. */
export const MAX_SNAPSHOTS_PER_STORY = 100;
