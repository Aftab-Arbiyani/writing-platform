import { Column, Entity, Index } from 'typeorm';
import type { PaymentMethodType, PaymentProvider } from '@qalam/shared';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * Maps a Qalam user to their provider-side customer record (AF5). One row per user
 * per provider is possible, but the common case is one; `uq` is (userId, provider).
 * Holds only NON-sensitive display data (card brand/last4) — never a PAN, never a raw
 * token (PCI-conscious: card data lives with the provider, docs 13). The Billing
 * service upserts this when a user first checks out.
 */
@Entity('monetization_customers')
@Index('uq_customer_user_provider', ['userId', 'provider'], { unique: true })
@Index('idx_customer_provider_ref', ['provider', 'providerCustomerId'])
export class MonetizationCustomer extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 40 })
  provider!: PaymentProvider;

  /** Provider-native customer id (e.g. Stripe `cus_…`). */
  @Column({ type: 'varchar', length: 255 })
  providerCustomerId!: string;

  @Column({ type: 'varchar', length: 8, default: 'usd' })
  currency!: string;

  /** Default payment-method display type (card/apple_pay/…). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  defaultMethodType!: PaymentMethodType | null;

  /** Card brand (visa/mastercard) — display only. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  cardBrand!: string | null;

  /** Last 4 digits — display only (never the full number). */
  @Column({ type: 'varchar', length: 4, nullable: true })
  cardLast4!: string | null;

  /** Resolved tax region (country/state code) for tax computation. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  taxRegion!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
