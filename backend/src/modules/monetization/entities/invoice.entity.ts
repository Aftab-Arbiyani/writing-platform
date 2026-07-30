import { Column, Entity, Index } from 'typeorm';
import type { InvoiceStatus, PaymentProvider } from '@qalam/shared';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A billing document per period (AF5). Mutable because status transitions
 * (draft → open → paid → void/refunded). Amounts are minor units (cents); tax is
 * computed by the Tax service and stored so a re-render is stable. Line items are a
 * jsonb array (`[{ description, amount, quantity }]`). The Invoice service owns it.
 */
@Entity('invoices')
@Index('idx_invoice_user_created', ['userId', 'createdAt'])
@Index('uq_invoice_number', ['number'], { unique: true })
export class Invoice extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  /** Human-facing sequential-ish invoice number (e.g. `QLM-000123`). */
  @Column({ type: 'varchar', length: 40 })
  number!: string;

  @Column({ type: 'varchar', length: 40 })
  status!: InvoiceStatus;

  @Column({ type: 'varchar', length: 40, default: 'stripe' })
  provider!: PaymentProvider;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerInvoiceId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  subscriptionId!: string | null;

  @Column({ type: 'varchar', length: 8, default: 'usd' })
  currency!: string;

  /** Minor units (cents). */
  @Column({ type: 'int', default: 0 })
  subtotal!: number;

  @Column({ type: 'int', default: 0 })
  tax!: number;

  @Column({ type: 'int', default: 0 })
  total!: number;

  /** Discount applied (minor units), from a coupon/promotion. */
  @Column({ type: 'int', default: 0 })
  discount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  periodStart!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  periodEnd!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  dueAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  hostedUrl!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  pdfUrl!: string | null;

  /** `[{ description, amount, quantity }]` — the billed lines. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  lineItems!: Array<{ description: string; amount: number; quantity: number }>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
