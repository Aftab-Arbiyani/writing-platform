import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Elevated role grant (docs 04 §3.8). Pure join with a composite PK
 * `(user_id, role_id)` — no surrogate id, no `updated_at` (grants are inserted
 * and revoked, never mutated).
 *
 * The base `user` role is **implicit** — every account has it, so `user_roles`
 * stores only elevated grants (moderator/admin/super_admin). A user with no row
 * here is rank 0. FKs (`user_id` → users CASCADE, `role_id` → roles RESTRICT,
 * `granted_by` → users SET NULL) are declared in the migration.
 */
@Entity('user_roles')
export class UserRole {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @Index('idx_user_roles_role')
  @PrimaryColumn({ type: 'uuid' })
  roleId!: string;

  @Column({ type: 'uuid', nullable: true })
  grantedBy!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
