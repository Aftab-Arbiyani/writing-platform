import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * Single-use password-reset token (docs 13 §3 — password reset flow).
 *
 * Same design as {@link VerificationToken}: only the SHA-256 **hash** is stored,
 * `usedAt` enforces single use, `expiresAt` enforces the 60 min lifetime, and a
 * new request invalidates prior unused tokens (service). Requesting a reset for
 * a non-existent email is a silent no-op (no enumeration, docs 13 §3.1). FK
 * `user_id` → users ON DELETE CASCADE is declared in the migration.
 */
@Entity('password_reset_tokens')
export class PasswordResetToken extends QalamBaseEntity {
  @Index('idx_password_reset_tokens_user')
  @Column({ type: 'uuid' })
  userId!: string;

  @Index('uq_password_reset_tokens_hash', { unique: true })
  @Column({ type: 'text' })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt!: Date | null;
}
