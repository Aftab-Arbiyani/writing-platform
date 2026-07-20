import { Column, Entity, Index } from 'typeorm';
import type { PaymentProvider, PurchaseKind, PurchaseStatus } from '@qalam/shared';

import { QalamAppendOnlyEntity } from '../../../common/base/append-only.entity';

/**
 * A purchase (AF5) — append-only. Covers store one-time buys, credit packs, and the
 * subscription-initiating purchase. The Purchase service records one per verified
 * transaction; `providerRef` (store transaction id / Stripe payment-intent) is UNIQUE
 * per provider so a restored/replayed receipt de-dupes rather than double-granting.
 * `receiptHash` stores a hash of the validated receipt (never the raw receipt) for
 * audit — server-side receipt validation is the authority, never the client.
 */
@Entity('purchases')
@Index('idx_purchase_user_created', ['userId', 'createdAt'])
@Index('uq_purchase_provider_ref', ['provider', 'providerRef'], {
  unique: true,
  where: '"provider_ref" IS NOT NULL',
})
export class Purchase extends QalamAppendOnlyEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  kind!: PurchaseKind;

  @Column({ type: 'varchar', length: 40 })
  status!: PurchaseStatus;

  @Column({ type: 'varchar', length: 40 })
  provider!: PaymentProvider;

  /** Provider-native transaction id / purchase token id (the dedupe key). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  providerRef!: string | null;

  /** Store product id (e.g. `com.qalam.pro.monthly`, `credits_5000`). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  productId!: string | null;

  /** Minor units (cents). */
  @Column({ type: 'int', default: 0 })
  amount!: number;

  @Column({ type: 'varchar', length: 8, default: 'usd' })
  currency!: string;

  @Column({ type: 'int', default: 0 })
  creditsGranted!: number;

  @Column({ type: 'uuid', nullable: true })
  subscriptionId!: string | null;

  /** SHA-256 (hex) of the validated store receipt — audit only, never the raw receipt. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  receiptHash!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
