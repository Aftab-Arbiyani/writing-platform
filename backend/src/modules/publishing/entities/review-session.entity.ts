import { Column, Entity, Index } from 'typeorm';
import { ReviewState } from '@qalam/shared';
import type { ReviewDecision } from '@qalam/shared';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * An editorial review session for one story (AF6). The review workflow is a
 * SEPARATE dimension from `PieceStatus`: a piece can be a draft that is
 * `in_review`, and only an `approved` session lets a review-gated story publish
 * (non-gated stories publish directly — unchanged behaviour).
 *
 * Mutable (state transitions in_review → approved/changes_requested → published),
 * so it extends {@link QalamBaseEntity} (id/created_at/updated_at). At most one
 * OPEN session (state not `approved`/`published`) per story — enforced in the
 * service, not by a DB constraint, to keep the history of closed sessions.
 *
 * `story_id` (= piece id) / `requested_by_id` / `reviewer_id` are plain uuids
 * with NO SQL FK: the review trail is decoupled from the `pieces` and `users`
 * lifecycles, exactly like `audit_logs` (docs 04 §1.4).
 */
@Entity('review_sessions')
@Index('idx_review_session_story', ['storyId'])
@Index('idx_review_session_story_state', ['storyId', 'state'])
export class ReviewSession extends QalamBaseEntity {
  /** The story (piece) under review — `story_id === piece_id`. */
  @Column({ type: 'uuid' })
  storyId!: string;

  /** The user who submitted the story for review. */
  @Column({ type: 'uuid' })
  requestedById!: string;

  /** Review lifecycle state (see `ReviewState`). */
  @Column({ type: 'varchar', length: 20, default: ReviewState.InReview })
  state!: ReviewState;

  /** The reviewer who took the decision; null until decided. */
  @Column({ type: 'uuid', nullable: true })
  reviewerId!: string | null;

  /** The reviewer's decision (approve/request_changes/reject); null until decided. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  decision!: ReviewDecision | null;

  /** Free-text reviewer notes (e.g. what to change); null when none. */
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** When the story was submitted for review. */
  @Column({ type: 'timestamptz' })
  submittedAt!: Date;

  /** When the reviewer decided; null while still in review. */
  @Column({ type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;
}
