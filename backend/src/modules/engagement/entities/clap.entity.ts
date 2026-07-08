import { Check, Column, Entity, Index, Unique } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * Claps — one ROW per user per piece holding a running `count` (docs 04 §3.4).
 * Unlike likes this is upserted (the count accumulates), so it keeps
 * `updated_at` ({@link QalamBaseEntity}). The cap is enforced three ways: the
 * `MAX_CLAPS_PER_USER_PER_PIECE` constant in the service, the `LEAST(…, 50)`
 * upsert, and this CHECK as the database backstop. Both FKs CASCADE (migration).
 */
@Entity('claps')
@Unique('uq_claps_user_piece', ['userId', 'pieceId'])
@Check('chk_claps_count_range', 'count BETWEEN 1 AND 50')
@Index('idx_claps_piece', ['pieceId', 'createdAt'])
export class Clap extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  pieceId!: string;

  @Column({ type: 'smallint', default: 1 })
  count!: number;
}
