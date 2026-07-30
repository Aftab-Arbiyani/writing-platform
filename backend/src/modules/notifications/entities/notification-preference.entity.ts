import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Per-user notification toggles (E9) — a 1:1 satellite of {@link User} (PK is the
 * user id, docs 04 §1.3). The `NotificationService` reads these before creating a
 * notification and skips a disabled category, so the toggles actually gate
 * delivery. A missing row means "all enabled" (the service defaults every flag to
 * true), so users only get a row once they change something.
 *
 * Categories map to notification types: `follow` → follow/follow_request/
 * follow_accepted; `comment` → comment; `reply` → comment_reply; `reaction` →
 * like/clap; `mention` → mention; `response` → response; `system` → system.
 *
 * FK `user_id` → users ON DELETE CASCADE (migration).
 */
@Entity('notification_preferences')
export class NotificationPreference {
  /** PK = FK → users. */
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'boolean', default: true })
  follow!: boolean;

  @Column({ type: 'boolean', default: true })
  comment!: boolean;

  @Column({ type: 'boolean', default: true })
  reply!: boolean;

  @Column({ type: 'boolean', default: true })
  reaction!: boolean;

  @Column({ type: 'boolean', default: true })
  mention!: boolean;

  @Column({ type: 'boolean', default: true })
  response!: boolean;

  @Column({ type: 'boolean', default: true })
  system!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
