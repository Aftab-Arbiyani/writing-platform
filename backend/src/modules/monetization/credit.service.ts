import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreditEntryType } from '@qalam/shared';
import type { CreditReason as CreditReasonType } from '@qalam/shared';
import { DataSource, Repository } from 'typeorm';

import type { CursorPayload } from '../../common/pagination/cursor.util';
import { CreditTransaction } from './entities/credit-transaction.entity';
import { CreditWallet } from './entities/credit-wallet.entity';

/** A grant/debit request against a user's wallet. */
export interface CreditMutation {
  userId: string;
  amount: number;
  reason: CreditReasonType;
  feature?: string | null;
  tokens?: number;
  costUsd?: number;
  refType?: string | null;
  refId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * The Credit service (AF5) — the single owner of AI credits. It keeps the mutable
 * `credit_wallets` balance consistent with the append-only `credit_transactions` ledger:
 * every grant (purchase/subscription/promo/refund) and debit (AI usage) is written in ONE
 * transaction that also updates the running balance, so the ledger is always the source of
 * truth and the balance is a fast cache of its sum. Balance never goes negative (a debit
 * clamps at 0 — over-spend is prevented upstream by the Usage meter's quota check).
 */
@Injectable()
export class CreditService {
  constructor(
    @InjectRepository(CreditWallet) private readonly wallets: Repository<CreditWallet>,
    @InjectRepository(CreditTransaction)
    private readonly transactions: Repository<CreditTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * The user's wallet, or `null` if they have never had one — a pure READ.
   *
   * Exists because {@link getOrCreateWallet} writes, and an admin merely LOOKING at an account
   * must not thereby create a row for it (B8, A1-3). A missing wallet is not an error state: a
   * user who has never been granted or spent a credit has an effective balance of 0, which is
   * exactly what {@link balance} already reports for them. The caller decides how to say so.
   */
  async findWallet(userId: string): Promise<CreditWallet | null> {
    return this.wallets.findOne({ where: { userId } });
  }

  /** The user's wallet, creating an empty one on first access. */
  async getOrCreateWallet(userId: string): Promise<CreditWallet> {
    const existing = await this.wallets.findOne({ where: { userId } });
    if (existing !== null) {
      return existing;
    }
    return this.wallets.save(
      this.wallets.create({ userId, balance: 0, lifetimeGranted: 0, lifetimeConsumed: 0 }),
    );
  }

  async balance(userId: string): Promise<number> {
    const wallet = await this.wallets.findOne({ where: { userId } });
    return wallet?.balance ?? 0;
  }

  /** Credit the wallet (grant). Returns the new balance. */
  async grant(input: CreditMutation): Promise<number> {
    return this.apply(input, CreditEntryType.Grant, Math.abs(input.amount));
  }

  /**
   * Debit the wallet (consume). `amount` may be 0 (free-tier AI call that only records
   * telemetry). Clamps the balance at 0. Returns the new balance.
   */
  async debit(input: CreditMutation): Promise<number> {
    return this.apply(input, CreditEntryType.Debit, -Math.abs(input.amount));
  }

  /** Cursor-paginated ledger for the user (newest first). */
  async listTransactions(
    userId: string,
    cursor: CursorPayload | null,
    limit: number,
  ): Promise<CreditTransaction[]> {
    const qb = this.transactions
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .orderBy('t.created_at', 'DESC')
      .addOrderBy('t.id', 'DESC')
      .limit(limit + 1);
    if (cursor !== null) {
      qb.andWhere('(t.created_at, t.id) < (:ck::timestamptz, :cid::uuid)', {
        ck: cursor.k,
        cid: cursor.id,
      });
    }
    return qb.getMany();
  }

  private async apply(
    input: CreditMutation,
    type: CreditEntryType,
    delta: number,
  ): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      // Lock the wallet row so concurrent debits/grants serialize on the balance.
      let wallet = await manager.findOne(CreditWallet, {
        where: { userId: input.userId },
        lock: { mode: 'pessimistic_write' },
      });
      wallet ??= await manager.save(
        manager.create(CreditWallet, {
          userId: input.userId,
          balance: 0,
          lifetimeGranted: 0,
          lifetimeConsumed: 0,
        }),
      );

      const nextBalance = Math.max(0, wallet.balance + delta);
      const applied = nextBalance - wallet.balance; // actual change after clamping
      wallet.balance = nextBalance;
      if (type === CreditEntryType.Grant) {
        wallet.lifetimeGranted += Math.max(0, delta);
      } else {
        wallet.lifetimeConsumed += Math.abs(applied);
      }
      await manager.save(wallet);

      await manager.save(
        manager.create(CreditTransaction, {
          userId: input.userId,
          walletId: wallet.id,
          type,
          reason: input.reason,
          delta: applied,
          balanceAfter: wallet.balance,
          feature: input.feature ?? null,
          tokens: input.tokens ?? 0,
          costUsd: input.costUsd ?? 0,
          refType: input.refType ?? null,
          refId: input.refId ?? null,
          metadata: input.metadata ?? {},
        }),
      );
      return wallet.balance;
    });
  }
}
