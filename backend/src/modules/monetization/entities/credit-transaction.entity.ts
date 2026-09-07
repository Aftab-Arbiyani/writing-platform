import { Column, Entity, Index } from 'typeorm';

import { QalamAppendOnlyEntity } from '../../../common/base/append-only.entity';

/**
 * One entry in the retired AI credit ledger (AF5).
 *
 * **Nothing reads or writes this table any more.** B4 removed the credit economy and the
 * vocabulary contract removed the last reader — the monetization Usage service used to
 * aggregate its daily/monthly/per-feature rollups from these rows, which is why they went
 * together. AI token and cost accounting lives in `ai_usage_logs` and always did.
 *
 * The file survives only until **Phase C**, and only for a mechanical reason worth knowing
 * before "tidying" it away: the TypeORM data source discovers entities by globbing
 * `*.entity.ts`, so deleting this class before the migration that drops the table makes the
 * next generated migration emit its own `DROP TABLE` — an unreviewed schema change riding
 * inside an unrelated diff. Delete the file and the table in the same commit, not before.
 *
 * `type` and `reason` are plain `string` rather than the old `CreditEntryType` /
 * `CreditReason` unions, which no longer exist. That is the honest declaration for a dead
 * table: whatever strings the rows happen to hold, nothing narrows them any more.
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
  type!: string;

  @Column({ type: 'varchar', length: 40 })
  reason!: string;

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
