import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * Single-use email-verification token (docs 13 §3 — verification flow).
 *
 * Only the **SHA-256 hash** of the token is stored; the raw token exists only in
 * the emailed link (docs 13: "never store token plaintext"). Verification hashes
 * the presented token and looks it up here. `usedAt` enforces single use;
 * `expiresAt` enforces the 24 h lifetime. A fresh request invalidates prior
 * unused tokens for the user (handled in the service). FK `user_id` → users
 * ON DELETE CASCADE is declared in the migration.
 */
@Entity('verification_tokens')
export class VerificationToken extends QalamBaseEntity {
  @Index('idx_verification_tokens_user')
  @Column({ type: 'uuid' })
  userId!: string;

  @Index('uq_verification_tokens_hash', { unique: true })
  @Column({ type: 'text' })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt!: Date | null;
}
