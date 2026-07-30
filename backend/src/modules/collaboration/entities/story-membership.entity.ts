import { Column, Entity, Index } from 'typeorm';
import type { StoryRole } from '@qalam/shared';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A collaborator's membership on one story (AF6). The story owner (the piece
 * author) has NO row here — ownership is resolved from the piece itself
 * (`PiecesService.getStoryContext`), so `owner` never appears as a stored role.
 * Every other collaborator (co-author / editor / reviewer / beta reader) is one
 * row.
 *
 * `storyId` (= pieceId), `userId`, and `invitedById` are plain uuids with NO SQL
 * foreign key — module isolation (docs 16 §3.1/§3.3); the service enforces
 * scoping. The unique `(storyId, userId)` index makes double-membership
 * impossible; `(storyId, role)` supports roster-by-role queries.
 */
@Entity('story_memberships')
@Index('uq_story_membership', ['storyId', 'userId'], { unique: true })
@Index('idx_story_membership_role', ['storyId', 'role'])
export class StoryMembership extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  storyId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: StoryRole;

  /** The collaborator who added/invited this member (null for direct owner adds). */
  @Column({ type: 'uuid', nullable: true })
  invitedById!: string | null;
}
