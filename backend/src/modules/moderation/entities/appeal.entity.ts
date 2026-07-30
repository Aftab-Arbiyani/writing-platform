import type { AppealStatus } from '@qalam/shared';
import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * An appeal filed by a moderated user against a resolved report's decision.
 * One appeal per report (unique `reportId`). A moderator/admin reviews it and
 * either approves (typically restoring content/user) or rejects.
 */
@Entity('appeals')
@Index('uq_appeals_report', ['reportId'], { unique: true })
@Index('idx_appeals_status', ['status', 'createdAt'])
@Index('idx_appeals_appellant', ['appellantId'])
export class Appeal extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  reportId!: string;

  /** The moderated user who is appealing. */
  @Column({ type: 'uuid' })
  appellantId!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: AppealStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewedById!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  reviewNotes!: string | null;
}
