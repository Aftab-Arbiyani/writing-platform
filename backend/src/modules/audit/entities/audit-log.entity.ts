import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Administrative audit trail (docs 13 §2, §11 — "every privileged mutation
 * leaves an audit trail"). Written by {@link AuditService} whenever an admin
 * mutates a user (suspend, verify, role change, force-logout, …).
 *
 * Append-only + immutable by design: the row is INSERTed once and never
 * UPDATEd or DELETEd (MaintenanceService deliberately excludes `audit_logs`
 * from pruning). It therefore extends nothing and declares its own narrow
 * columns — no `updated_at`, no `deleted_at` — per the append-only-table rule
 * in `common/base/base.entity.ts` (docs 04 §1.4).
 *
 * `actor_id` / `target_id` are plain uuids with **no FK** on purpose: the trail
 * must survive a hard-deleted user (7-year retention), so it is decoupled from
 * the `users` lifecycle rather than cascading away with it.
 */
@Entity('audit_logs')
@Index('idx_audit_logs_target', ['targetType', 'targetId', 'createdAt'])
@Index('idx_audit_logs_actor', ['actorId', 'createdAt'])
@Index('idx_audit_logs_action', ['action'])
export class AuditLog {
  @PrimaryColumn('uuid')
  id!: string;

  /** The admin who performed the action; null for system-originated events. */
  @Column({ type: 'uuid', nullable: true })
  actorId!: string | null;

  /** Snapshot of the actor's effective role at action time (roles can change). */
  @Column({ type: 'varchar', length: 30, nullable: true })
  actorRole!: string | null;

  /** Dot-cased action code, e.g. `user.suspend` (see AUDIT_ACTIONS). */
  @Column({ type: 'varchar', length: 80 })
  action!: string;

  /** The kind of entity acted upon — `user` for everything in E12.5. */
  @Column({ type: 'varchar', length: 40, default: 'user' })
  targetType!: string;

  /** The affected entity's id; null for non-targeted events (e.g. list export). */
  @Column({ type: 'uuid', nullable: true })
  targetId!: string | null;

  /** Structured context: before/after values, reason, bulk counts, etc. */
  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  /** Request IP (best-effort; null when not resolvable). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  userAgent!: string | null;

  /** The `X-Request-Id` of the originating request — ties the trail to the logs. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  requestId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Application-generated, time-ordered UUIDv7 primary key (docs 04 §1.4). */
  @BeforeInsert()
  protected assignId(): void {
    if (!this.id) {
      this.id = uuidv7();
    }
  }
}
