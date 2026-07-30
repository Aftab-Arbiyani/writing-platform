import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import type { EntityManager } from 'typeorm';

import { authConfig } from '../../../config/auth.config';
import { TransactionRunner } from '../../../common/database/transaction-runner';
import { UsersService } from '../../users/users.service';
import { VerificationToken } from '../entities/verification-token.entity';
import { VerificationInvalidException } from '../exceptions/auth.exceptions';
import { generateRawToken, hashToken } from './token-hash.util';

/**
 * Email-verification tokens (single-use, 24 h). `issue` returns the RAW token
 * for the caller to email; only its hash is stored. A fresh issue invalidates
 * the user's prior unused tokens. `consume` marks the token used and flips the
 * account to verified in one transaction.
 */
@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(VerificationToken)
    private readonly tokens: Repository<VerificationToken>,
    @Inject(authConfig.KEY) private readonly config: ConfigType<typeof authConfig>,
    private readonly usersService: UsersService,
    private readonly transactions: TransactionRunner,
  ) {}

  private repo(manager?: EntityManager): Repository<VerificationToken> {
    return manager ? manager.getRepository(VerificationToken) : this.tokens;
  }

  /** Issues a fresh token (invalidating prior ones) and returns the RAW value. */
  async issue(userId: string, manager?: EntityManager): Promise<string> {
    const repo = this.repo(manager);
    await repo.delete({ userId });

    const raw = generateRawToken();
    const expiresAt = new Date(Date.now() + this.config.verificationTtlHours * 3_600_000);
    await repo.save(repo.create({ userId, tokenHash: hashToken(raw), expiresAt }));
    return raw;
  }

  /** Consumes a token and marks the account verified; returns the user id. */
  async consume(rawToken: string): Promise<string> {
    return this.transactions.run(async (manager) => {
      const repo = this.repo(manager);
      const token = await repo.findOne({
        where: {
          tokenHash: hashToken(rawToken),
          usedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
      });
      if (token === null) {
        throw new VerificationInvalidException();
      }
      token.usedAt = new Date();
      await repo.save(token);
      await this.usersService.markEmailVerified(token.userId, manager);
      return token.userId;
    });
  }
}
