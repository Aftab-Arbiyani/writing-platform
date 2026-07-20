import { Column, Entity, Index } from 'typeorm';
import type { CreditEntryType, CreditReason } from '@qalam/shared';

import { QalamAppendOnlyEntity } from '../../../common/base/append-only.entity';

/**
 * One entry in the AI credit ledger (AF5) — append-only (never mutated). Every credit
 * grant (purchase/subscription/promo/refund) and every debit (AI usage/expiration) is
 * one row; the wallet balance is derived from and kept consistent with this ledger.
 *
 * This is ALSO the monetization Usage ledger for AI: every metered AI request writes a
 * `debit`/`ai_usage` row carrying `feature`, `tokens`, and `costUsd` (delta = credits
 * spent, which is 0 for free-tier calls that only record telemetry). The Usage service
 * aggregates daily/monthly/per-feature spend + forecasts from these rows, so AI usage
 * has ONE source of truth here (the raw provider token log stays in `ai_usage_logs`).
 */
@Entity('credit_transactions')
@Index('idx_credit_txn_user_created', ['userId', 'createdAt'])
@Index('idx_credit_txn_user_feature', ['userId', 'feature'])
export class CreditTransaction extends QalamAppendOnlyEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  walletId!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: CreditEntryType;

  @Column({ type: 'varchar', length: 40 })
  reason!: CreditReason;

  /** Signed change to the balance: positive for a grant, negative for a debit. */
  @Column({ type: 'int' })
  delta!: number;

  /** Wallet balance immediately after this entry (running balance for auditing). */
  @Column({ type: 'int' })
  balanceAfter!: number;

  /** The AI feature that consumed credits (debits from AI usage), else null. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  feature!: string | null;

  /** AI tokens attributed to this entry (for usage rollups). */
  @Column({ type: 'int', default: 0 })
  tokens!: number;

  /** Estimated USD cost attributed to this entry (for cost analytics). */
  @Column({ type: 'double precision', default: 0 })
  costUsd!: number;

  /** What this entry references (e.g. `ai_request`, `payment`, `subscription`, `coupon`). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  refType!: string | null;

  /** The referenced id (ai request/correlation id, payment id, coupon id, …). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  refId!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
