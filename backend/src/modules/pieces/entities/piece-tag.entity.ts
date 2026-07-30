import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Piece ↔ tag join (docs 04 §3.3). Composite PK; append-only (no `updated_at`).
 * FKs in the migration: `piece_id` → pieces CASCADE, `tag_id` → tags CASCADE.
 * Max tags per piece is a service-layer rule (`TAGS_MAX_PER_PIECE`, docs §3.3).
 */
@Entity('piece_tags')
export class PieceTag {
  @PrimaryColumn({ type: 'uuid' })
  pieceId!: string;

  @Index('idx_piece_tags_tag')
  @PrimaryColumn({ type: 'uuid' })
  tagId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
