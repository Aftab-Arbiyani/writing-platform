import { Column, Entity, Index, Unique } from 'typeorm';

import { QalamAppendOnlyEntity } from '../../../common/base/append-only.entity';

/**
 * Membership of a piece in a collection (docs 04 §3.5). Carries a payload
 * (`position`, `note`) so it takes a surrogate id rather than the pure-join
 * composite-PK form. Unique on `(collection_id, piece_id)` — a piece appears in
 * a collection at most once. Both FKs **ON DELETE CASCADE** in the migration.
 */
@Entity('collection_pieces')
@Unique('uq_collection_pieces', ['collectionId', 'pieceId'])
@Index('idx_collection_pieces_pos', ['collectionId', 'position'])
export class CollectionPiece extends QalamAppendOnlyEntity {
  @Column({ type: 'uuid' })
  collectionId!: string;

  @Column({ type: 'uuid' })
  pieceId!: string;

  @Column({ type: 'integer', default: 0 })
  position!: number;

  @Column({ type: 'varchar', length: 300, nullable: true })
  note!: string | null;
}
