import { Column, Entity, Index, Unique } from 'typeorm';

import { QalamAppendOnlyEntity } from '../../../common/base/append-only.entity';

/**
 * A private bookmark — one per user per piece (docs 04 §3.4). Append-only; the
 * only hot read is the owner's own listing (`idx_bookmarks_user`). Bookmarks are
 * private: no piece-level bookmark listing, only `GET /me/bookmarks`. Both FKs
 * **ON DELETE CASCADE** in the migration.
 */
@Entity('bookmarks')
@Unique('uq_bookmarks_user_piece', ['userId', 'pieceId'])
@Index('idx_bookmarks_user', ['userId', 'createdAt'])
export class Bookmark extends QalamAppendOnlyEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  pieceId!: string;
}
