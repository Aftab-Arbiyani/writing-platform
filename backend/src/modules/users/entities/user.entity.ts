import { UserStatus } from '@qalam/shared';
import { Check, Column, Entity, Index } from 'typeorm';

import { QalamAuditEntity } from '../../../common/base/audit.entity';

/**
 * Account root aggregate (docs 04 §3.1). Soft-deletable (extends
 * {@link QalamAuditEntity}) — account deactivation is reversible for a grace
 * window; erasure is a separate hard-delete job.
 *
 * Deliberate modelling (docs 04 §3.1, do not "fix" into the brief's flat shape):
 * - verification is a **timestamp** `emailVerifiedAt` (null = unverified), not a
 *   boolean;
 * - there is **no `role` column** — roles live in `user_roles` (RBAC, §3.8);
 * - there is **no `google_id` column** — external identities live in
 *   `auth_identities` (§3.1). `passwordHash` is null for OAuth-only accounts.
 *
 * `email` and `username` are `citext` (case-insensitive) and unique **including
 * soft-deleted rows** (docs 04 §1.5): a permanent username stays claimed.
 */
@Entity('users')
@Check('chk_users_username_format', "username ~ '^[a-z0-9_]{3,30}$'")
export class User extends QalamAuditEntity {
  @Index('uq_users_email', { unique: true })
  @Column({ type: 'citext' })
  email!: string;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  /** Argon2id PHC string; null = OAuth-only account (docs 04 §3.1). */
  @Column({ type: 'text', nullable: true })
  passwordHash!: string | null;

  @Index('uq_users_username', { unique: true })
  @Column({ type: 'citext' })
  username!: string;

  @Column({
    type: 'enum',
    enum: Object.values(UserStatus),
    enumName: 'user_status',
    default: UserStatus.Active,
  })
  status!: UserStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  /** Convenience read (docs 04 §3.1: `email_verified_at IS NULL` = unverified). */
  get isEmailVerified(): boolean {
    return this.emailVerifiedAt !== null;
  }
}
