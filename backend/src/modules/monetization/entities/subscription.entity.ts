import { Column, Entity, Index } from 'typeorm';
import type { BillingInterval, PaymentProvider, PlanTier, SubscriptionStatus } from '@qalam/shared';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A user's subscription (AF5) — the mutable aggregate the Subscription service owns.
 * One row per user (a user has at most one subscription; free users have none). The
 * Entitlement service derives premium access from `status` + `tier` + overrides; it
 * NEVER reads this table directly except through the Subscription service.
 *
 * Ownership is a plain `userId` column (no FK — module isolation, docs 16 §3.3); the
 * service enforces owner-scoping. Provider ids are opaque (Stripe/Apple/Google);
 * amounts are minor units (cents). `scheduled*` capture a pending future plan change
 * (a downgrade or interval switch applied at period end).
 */
@Entity('subscriptions')
@Index('uq_subscription_user', ['userId'], { unique: true })
@Index('idx_subscription_status', ['status'])
@Index('idx_subscription_period_end', ['currentPeriodEnd'])
export class Subscription extends QalamBaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 40 })
  tier!: PlanTier;

  @Column({ type: 'varchar', length: 40 })
  status!: SubscriptionStatus;

  @Column({ type: 'varchar', length: 20 })
  interval!: BillingInterval;

  @Column({ type: 'varchar', length: 40 })
  provider!: PaymentProvider;

  @Column({ type: 'varchar', length: 8, default: 'usd' })
  currency!: string;

  /** Provider-native subscription id (Stripe sub / store original txn id). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  providerSubscriptionId!: string | null;

  /** Provider-native customer id (Stripe `cus_…`) — used to resolve webhooks. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  providerCustomerId!: string | null;

  @Column({ type: 'boolean', default: true })
  autoRenew!: boolean;

  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodStart!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodEnd!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  trialStart!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  trialEnd!: Date | null;

  /** End of the dunning/grace window after a failed renewal (access still granted until then). */
  @Column({ type: 'timestamptz', nullable: true })
  gracePeriodEnd!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  canceledAt!: Date | null;

  /** A scheduled future plan change applied at period end (downgrade / interval switch). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  scheduledTier!: PlanTier | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  scheduledInterval!: BillingInterval | null;

  /** Provider price/product ids + arbitrary provider metadata (opaque). */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
