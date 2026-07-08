import type { NotificationEntityType, NotificationType } from '@qalam/shared';
import { Column, Entity, Index } from 'typeorm';

import { QalamAuditEntity } from '../../../common/base/audit.entity';

/**
 * A single in-app notification delivered to one recipient (E9; docs 04 §3.7).
 * Follows the docs design: a polymorphic target (`entity_type`/`entity_id`) plus
 * a denormalized `data` payload (actor username, piece title/slug at emit time)
 * so the inbox renders WITHOUT joins. Extended beyond the docs baseline with
 * `archived_at` (Archived state) and soft delete via {@link QalamAuditEntity}
 * `deleted_at` (Deleted state) — status is DERIVED from these + `read_at`, never
 * a stored column (docs 16 §1.3).
 *
 * FKs (migration, docs 04 §10): `recipient_id` → users ON DELETE CASCADE (inbox
 * dies with the account); `actor_id` → users ON DELETE SET NULL (history outlives
 * the actor). Written only by the notification engine, never inline in request
 * handlers (docs 04 §3.7).
 */
@Entity('notifications')
@Index('idx_notifications_inbox', ['recipientId', 'createdAt'])
@Index('idx_notifications_recipient_type', ['recipientId', 'type'])
export class Notification extends QalamAuditEntity {
  @Column({ type: 'uuid' })
  recipientId!: string;

  /** The user who triggered it; null for system/actor-less notifications. */
  @Column({ type: 'uuid', nullable: true })
  actorId!: string | null;

  /** Open catalogue (`@qalam/shared` NotificationType) — varchar so new kinds need no migration. */
  @Column({ type: 'varchar', length: 40 })
  type!: NotificationType;

  /** Polymorphic pointer kind (`piece` | `comment` | `user` | …), null if none. */
  @Column({ type: 'varchar', length: 30, nullable: true })
  entityType!: NotificationEntityType | null;

  @Column({ type: 'uuid', nullable: true })
  entityId!: string | null;

  /** Denormalized render payload so listing never joins (docs 04 §3.7). */
  @Column({ type: 'jsonb', default: {} })
  data!: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;
}
