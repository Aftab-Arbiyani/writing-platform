import { Column, Entity, Index } from 'typeorm';

import { QalamAuditEntity } from '../../../common/base/audit.entity';

/**
 * A comment on a piece (E7 — net-new; docs 04 records the table addition). A
 * reply is simply a comment with a non-null `parentId` (adjacency list) — the
 * user's "CommentReply" is realized as this self-reference, which is the only
 * model that supports arbitrary nesting to `MAX_COMMENT_DEPTH`. `depth` is
 * denormalized (top-level = 1, reply = parent.depth + 1) so the reply-depth rule
 * is enforced with a single read.
 *
 * Soft-deletable ({@link QalamAuditEntity}): a deleted comment keeps its node so
 * the thread renders "This comment has been deleted." and its replies stay
 * visible. `editedAt` records the last edit (comment editing history — the
 * updated timestamp); it stays null until the first edit.
 *
 * Plain FK columns (constraints in the migration, docs 16 §3.1): `piece_id` →
 * pieces CASCADE, `author_id` → users CASCADE, `parent_id` → comments CASCADE.
 */
@Entity('comments')
@Index('idx_comments_piece', ['pieceId', 'createdAt'])
@Index('idx_comments_parent', ['parentId', 'createdAt'])
@Index('idx_comments_author', ['authorId'])
export class Comment extends QalamAuditEntity {
  @Column({ type: 'uuid' })
  pieceId!: string;

  @Column({ type: 'uuid' })
  authorId!: string;

  /** Null for a top-level comment; the parent comment id for a reply. */
  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  /** 1 for top-level; parent.depth + 1 for a reply. Capped at MAX_COMMENT_DEPTH. */
  @Column({ type: 'smallint', default: 1 })
  depth!: number;

  @Column({ type: 'text' })
  body!: string;

  /** Set on every edit (null until first edit) — the edit-history timestamp. */
  @Column({ type: 'timestamptz', nullable: true })
  editedAt!: Date | null;
}
