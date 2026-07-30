import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';
import type { BlockKind } from '../trust.constants';

/**
 * A personal block or mute edge from `blockerId` → `blockedId` (AF6). The unique
 * index makes (blocker, blocked, kind) idempotent — re-blocking is a no-op, never
 * a duplicate row. A `block` edge (either direction) severs interaction and is
 * read by the Policy Engine; a `mute` only affects the muter's own feed. No SQL
 * FKs — the edge is user data that must survive an account tombstone lookup.
 */
@Entity('user_blocks')
@Index('uq_user_blocks', ['blockerId', 'blockedId', 'kind'], { unique: true })
export class UserBlock extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  blockerId!: string;

  @Column({ type: 'uuid' })
  blockedId!: string;

  @Column({ type: 'varchar', length: 10 })
  kind!: BlockKind;
}
