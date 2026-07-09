import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Not, IsNull, type Repository } from 'typeorm';

import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { VerificationToken } from '../entities/verification-token.entity';

/** Rows removed from each single-use-token table by the cleanup. */
export interface TokenPruneResult {
  verification: number;
  passwordReset: number;
}

/**
 * Auth-side maintenance (Epic 11). Exposes a single exported entry point for the
 * maintenance worker to hard-delete spent single-use tokens — expired past the
 * cutoff OR already consumed (`used_at` set). Rotating refresh tokens are NOT
 * here (they live in Redis DB 3 and expire by TTL — docs 13 §3.2), and this
 * never touches `audit_logs` (7-year retention).
 *
 * Kept out of `AuthService` so the maintenance dependency does not widen the
 * auth request path; exported by `AuthModule` so the maintenance worker calls a
 * service, never another module's repository (the boundary rule).
 */
@Injectable()
export class AuthMaintenanceService {
  constructor(
    @InjectRepository(VerificationToken)
    private readonly verificationTokens: Repository<VerificationToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokens: Repository<PasswordResetToken>,
  ) {}

  /** Delete verification + reset tokens expired before `cutoff` or already used. */
  async pruneExpiredTokens(cutoff: Date): Promise<TokenPruneResult> {
    const [verification, passwordReset] = await Promise.all([
      this.prune(this.verificationTokens, cutoff),
      this.prune(this.passwordResetTokens, cutoff),
    ]);
    return { verification, passwordReset };
  }

  private async prune<T extends { expiresAt: Date; usedAt: Date | null }>(
    repo: Repository<T>,
    cutoff: Date,
  ): Promise<number> {
    // Expired past the cutoff …
    const expired = await repo.delete({ expiresAt: LessThan(cutoff) } as never);
    // … or already consumed (single-use).
    const used = await repo.delete({ usedAt: Not(IsNull()) } as never);
    return (expired.affected ?? 0) + (used.affected ?? 0);
  }
}
