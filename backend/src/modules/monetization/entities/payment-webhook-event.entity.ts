import { Column, Entity, Index } from 'typeorm';
import type { PaymentProvider, WebhookEventStatus } from '@qalam/shared';

import { QalamAppendOnlyEntity } from '../../../common/base/append-only.entity';

/**
 * A received payment-provider webhook (AF5) — append-only. Written the instant a webhook
 * arrives (after signature verification) and BEFORE any effect is applied, so processing
 * is idempotent and replay-safe: the (provider, providerEventId) pair is UNIQUE, so a
 * duplicate delivery is detected and skipped. `signatureValid` records the verification
 * outcome; `status` tracks received → processed/failed/ignored/duplicate. The raw payload
 * is retained (jsonb) for audit + reprocessing.
 */
@Entity('payment_webhook_events')
@Index('uq_webhook_provider_event', ['provider', 'providerEventId'], { unique: true })
@Index('idx_webhook_status_created', ['status', 'createdAt'])
export class PaymentWebhookEvent extends QalamAppendOnlyEntity {
  @Column({ type: 'varchar', length: 40 })
  provider!: PaymentProvider;

  /** Provider-native event id — the idempotency/replay key. */
  @Column({ type: 'varchar', length: 255 })
  providerEventId!: string;

  @Column({ type: 'varchar', length: 120 })
  type!: string;

  @Column({ type: 'boolean', default: false })
  signatureValid!: boolean;

  @Column({ type: 'varchar', length: 20 })
  status!: WebhookEventStatus;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  error!: string | null;

  /** The raw provider event payload (for audit + reprocessing). */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;
}
