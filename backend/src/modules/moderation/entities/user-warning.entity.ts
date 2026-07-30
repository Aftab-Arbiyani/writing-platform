import type { ReportSeverity } from '@qalam/shared';
import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A formal warning issued to a user by a moderator (append-only). Surfaced in the
 * user's moderation history and counted in the admin user detail. Optionally links
 * the report that prompted it.
 */
@Entity('user_warnings')
@Index('idx_user_warnings_user', ['userId', 'createdAt'])
export class UserWarning extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  moderatorId!: string;

  @Column({ type: 'uuid', nullable: true })
  reportId!: string | null;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'varchar', length: 20, default: 'low' })
  severity!: ReportSeverity;
}
