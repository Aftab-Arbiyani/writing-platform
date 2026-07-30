import type { StrikeSeverity } from '@qalam/shared';
import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A single policy strike against a user (append-only). `weight` (from
 * `STRIKE_WEIGHTS[severity]`) is snapshotted at issue time so re-weighting a
 * severity later never rewrites history. A strike is "active" while both
 * `revokedAt IS NULL` and it hasn't expired; the summed active weight drives
 * auto-restriction / auto-suspension. `reportId` optionally links the report that
 * prompted it. No SQL FKs (evidence outlives the target).
 */
@Entity('user_strikes')
@Index('idx_user_strikes_user', ['userId', 'createdAt'])
export class UserStrike extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  severity!: StrikeSeverity;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'int' })
  weight!: number;

  @Column({ type: 'uuid', nullable: true })
  reportId!: string | null;

  @Column({ type: 'uuid' })
  issuedById!: string;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
