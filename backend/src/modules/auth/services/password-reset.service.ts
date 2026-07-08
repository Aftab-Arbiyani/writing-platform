import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import type { EntityManager } from 'typeorm';

import { authConfig } from '../../../config/auth.config';
import { TransactionRunner } from '../../../common/database/transaction-runner';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { ResetInvalidException } from '../exceptions/auth.exceptions';
import { generateRawToken, hashToken } from './token-hash.util';

/**
 * Password-reset tokens (single-use, 60 min). Same shape as verification, but
 * the caller (AuthService) performs the actual password update + session
 * revocation after `consume` returns the user id — keeping this service focused
 * on token lifecycle only (SRP).
 */
@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly tokens: Repository<PasswordResetToken>,
    @Inject(authConfig.KEY) private readonly config: ConfigType<typeof authConfig>,
    private readonly transactions: TransactionRunner,
  ) {}

  private repo(manager?: EntityManager): Repository<PasswordResetToken> {
    return manager ? manager.getRepository(PasswordResetToken) : this.tokens;
  }

  /** Issues a fresh reset token (invalidating prior ones); returns the RAW value. */
  async issue(userId: string, manager?: EntityManager): Promise<string> {
    const repo = this.repo(manager);
    await repo.delete({ userId });

    const raw = generateRawToken();
    const expiresAt = new Date(Date.now() + this.config.passwordResetTtlMinutes * 60_000);
    await repo.save(repo.create({ userId, tokenHash: hashToken(raw), expiresAt }));
    return raw;
  }

  /**
   * Validates + consumes a reset token inside a transaction, invoking `apply`
   * with the user id and the transaction manager so the caller updates the
   * password atomically with marking the token used. Throws `AUTH_RESET_INVALID`
   * for a missing/expired/used token.
   */
  async consume(
    rawToken: string,
    apply: (userId: string, manager: EntityManager) => Promise<void>,
  ): Promise<void> {
    await this.transactions.run(async (manager) => {
      const repo = this.repo(manager);
      const token = await repo.findOne({
        where: {
          tokenHash: hashToken(rawToken),
          usedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
      });
      if (token === null) {
        throw new ResetInvalidException();
      }
      token.usedAt = new Date();
      await repo.save(token);
      await apply(token.userId, manager);
    });
  }
}
