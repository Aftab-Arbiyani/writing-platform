import { Check, Entity, Index, Column, Unique } from 'typeorm';

import { QalamAppendOnlyEntity } from '../../../common/base/append-only.entity';

/**
 * The link that makes one piece a response to another (docs 04 §3.2 `responses`
 * table). A response IS a piece — this row only records the relationship:
 * `piece_id` is the response (child) piece, `parent_piece_id` is the piece being
 * responded to. Unique on `piece_id` (a piece responds to at most one parent);
 * `chk_responses_not_self` blocks self-responses. Append-only. Both FKs **ON
 * DELETE CASCADE** in the migration — the link dies with either piece, but the
 * response piece itself survives as a standalone piece.
 */
@Entity('responses')
@Unique('uq_responses_piece', ['pieceId'])
@Check('chk_responses_not_self', 'piece_id <> parent_piece_id')
@Index('idx_responses_parent', ['parentPieceId', 'createdAt'])
export class PieceResponse extends QalamAppendOnlyEntity {
  @Column({ type: 'uuid' })
  pieceId!: string;

  @Column({ type: 'uuid' })
  parentPieceId!: string;
}
