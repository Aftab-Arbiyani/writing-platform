import { Column, Entity, Index } from 'typeorm';
import type { PaymentMethodType, PaymentProvider, PaymentStatus } from '@qalam/shared';

import { QalamAppendOnlyEntity } from '../../../common/base/append-only.entity';

/**
 * One payment attempt / event (AF5) — append-only ledger. A charge, a refund (negative
 * `amount`), a chargeback — each is its own immutable row. `amount` is minor units
 * (cents); `providerPaymentId` is the provider's charge/transaction id (unique per
 * provider so a replayed webhook can dedupe). The payment audit trail is this table +
 * the shared audit log.
 */
@Entity('payments')
@Index('idx_payment_user_created', ['userId', 'createdAt'])
@Index('uq_payment_provider_ref', ['provider', 'providerPaymentId'], {
  unique: true,
  where: '"provider_payment_id" IS NOT NULL',
})
export class Payment extends QalamAppendOnlyEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 40 })
  provider!: PaymentProvider;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerPaymentId!: string | null;

  @Column({ type: 'varchar', length: 40 })
  status!: PaymentStatus;

  @Column({ type: 'varchar', length: 40, default: 'unknown' })
  method!: PaymentMethodType;

  /** Minor units (cents). Negative for a refund. */
  @Column({ type: 'int' })
  amount!: number;

  @Column({ type: 'varchar', length: 8, default: 'usd' })
  currency!: string;

  @Column({ type: 'uuid', nullable: true })
  subscriptionId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  invoiceId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  /** Provider decline/failure code, when the status is failed. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  failureReason!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
