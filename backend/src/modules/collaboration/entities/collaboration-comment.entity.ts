import { Column, Entity, Index } from 'typeorm';
import { CommentKind, CommentStatus } from '@qalam/shared';

import { QalamAuditEntity } from '../../../common/base/audit.entity';

/** Text-range anchor for an inline comment (TipTap document positions + the quoted text). */
export interface CommentAnchor {
  from: number;
  to: number;
  quote?: string;
}

/**
 * A collaboration comment or reply on a story (AF6). Soft-deletable
 * ({@link QalamAuditEntity}) — deleting a comment tombstones it so threads keep
 * their shape and it can be recovered by moderation. A `general` comment is
 * story-level; an `inline` comment carries an {@link CommentAnchor}. `parentId`
 * links a reply to its root, forming a one-level thread.
 *
 * `mentions` is the resolved set of @mentioned user ids (jsonb `uuid[]`), used to
 * fan out mention notifications. `storyId` / `authorId` / `parentId` /
 * `resolvedById` are plain uuids (no FK — module isolation).
 */
@Entity('collaboration_comments')
@Index('idx_collab_comment_story', ['storyId', 'status', 'createdAt'])
@Index('idx_collab_comment_parent', ['parentId'])
export class CollaborationComment extends QalamAuditEntity {
  @Column({ type: 'uuid' })
  storyId!: string;

  @Column({ type: 'uuid' })
  authorId!: string;

  /** Root comment of the thread this reply belongs to; null for a root comment. */
  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  @Column({ type: 'varchar', length: 10, default: CommentKind.General })
  kind!: CommentKind;

  @Column({ type: 'jsonb', nullable: true })
  anchor!: CommentAnchor | null;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'varchar', length: 10, default: CommentStatus.Open })
  status!: CommentStatus;

  /** Who resolved the thread (null while open). */
  @Column({ type: 'uuid', nullable: true })
  resolvedById!: string | null;

  /** Resolved @mentioned user ids (fan out mention notifications). */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  mentions!: string[];
}
