import { Column, Entity, Index } from 'typeorm';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A user's AI credit wallet (AF5) — the mutable balance aggregate the Credit service
 * owns. One row per user. `balance` is the spendable credit count; the append-only
 * `credit_transactions` ledger is the source of truth for HOW the balance got there
 * (every grant/debit writes a row, and `balance` is refreshed in the same transaction).
 * Credits are integers (no fractional credit).
 */
@Entity('credit_wallets')
@Index('uq_credit_wallet_user', ['userId'], { unique: true })
export class CreditWallet extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  /** Current spendable balance (never negative — the service clamps at 0). */
  @Column({ type: 'int', default: 0 })
  balance!: number;

  @Column({ type: 'int', default: 0 })
  lifetimeGranted!: number;

  @Column({ type: 'int', default: 0 })
  lifetimeConsumed!: number;
}
