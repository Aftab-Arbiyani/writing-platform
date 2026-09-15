import { Column, Entity, Index, Unique } from 'typeorm';

import { AppAppendOnlyEntity } from '../../../common/base/append-only.entity';

/**
 * A like — one per user per piece (docs 04 §3.4). Append-only
 * ({@link AppAppendOnlyEntity}): liking inserts, unliking hard-deletes; a
 * soft-deleted like would be a contradiction (§1.5). Both FKs **ON DELETE
 * CASCADE** live in the migration — a like without either side is garbage.
 */
@Entity('likes')
@Unique('uq_likes_user_piece', ['userId', 'pieceId'])
@Index('idx_likes_piece', ['pieceId', 'createdAt'])
export class Like extends AppAppendOnlyEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  pieceId!: string;
}
