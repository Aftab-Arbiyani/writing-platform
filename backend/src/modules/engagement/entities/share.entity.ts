import { ShareChannel } from '@qalam/shared';
import { Column, Entity, Index } from 'typeorm';

import { QalamAppendOnlyEntity } from '../../../common/base/append-only.entity';

/**
 * A single share event (E7 — share tracking, ADR §10). Phase 1 stores the COUNT
 * only (`piece_stats.shares_count`); there is no analytics dashboard yet, so
 * this table is a thin append-only log kept for future rollups. `channel`
 * records how it was shared (internal / external / copy-link).
 *
 * `user_id` is nullable — a public piece can be shared by an anonymous reader;
 * FK **ON DELETE SET NULL** so the count-backing row survives account erasure.
 * `piece_id` → pieces **ON DELETE CASCADE** in the migration.
 */
@Entity('shares')
@Index('idx_shares_piece', ['pieceId', 'createdAt'])
export class Share extends QalamAppendOnlyEntity {
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'uuid' })
  pieceId!: string;

  @Column({
    type: 'enum',
    enum: Object.values(ShareChannel),
    enumName: 'share_channel',
  })
  channel!: ShareChannel;
}
