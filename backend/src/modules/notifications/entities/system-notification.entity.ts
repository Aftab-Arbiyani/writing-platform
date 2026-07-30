import { Column, Entity } from 'typeorm';

import { QalamAuditEntity } from '../../../common/base/audit.entity';

/**
 * An admin-authored broadcast (E9). Creating one fans out a per-user
 * `Notification` (type `system`) to every eligible recipient, so all the read /
 * archive / delete / unread-count machinery works uniformly; this table is the
 * source-of-truth / audit record for the broadcast itself. Soft-deletable (recall)
 * via {@link QalamAuditEntity} `deleted_at`.
 *
 * FK `created_by` → users ON DELETE SET NULL (the broadcast outlives the admin).
 */
@Entity('system_notifications')
export class SystemNotification extends QalamAuditEntity {
  @Column({ type: 'varchar', length: 150 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  /** Optional extra render payload merged into each delivered notification's data. */
  @Column({ type: 'jsonb', default: {} })
  data!: Record<string, unknown>;

  /** Admin who authored the broadcast (null once that account is erased). */
  @Column({ type: 'uuid', nullable: true })
  createdBy!: string | null;

  /** Targeting — `all` in Phase 1; segments are a future extension. */
  @Column({ type: 'varchar', length: 20, default: 'all' })
  audience!: string;
}
