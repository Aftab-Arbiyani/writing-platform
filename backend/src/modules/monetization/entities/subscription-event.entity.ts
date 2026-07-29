import { Column, Entity, Index } from 'typeorm';
import type { PlanTier, SubscriptionEventType, SubscriptionStatus } from '@qalam/shared';

import { QalamAppendOnlyEntity } from '../../../common/base/append-only.entity';

/**
 * One entry of a subscription's lifecycle history (AF5) — append-only. The Subscription
 * service writes one on every transition (created/renewed/upgraded/downgraded/canceled/
 * trial started+ended/grace/expired/paused/resumed). Powers the subscription-history
 * screen AND the subscription/conversion analytics (churn, upgrade/downgrade rates)
 * without a `COUNT(*)` on the hot path.
 */
@Entity('subscription_events')
@Index('idx_subscription_event_sub_created', ['subscriptionId', 'createdAt'])
@Index('idx_subscription_event_type_created', ['type', 'createdAt'])
/**
 * Owner-scoped keyset pagination, matching `idx_invoice_user_created`,
 * `idx_payment_user_created` and `idx_purchase_user_created` on the three sibling ledgers.
 *
 * Added with the W4-1 fix: `listHistory` used to resolve the subscription first and filter by
 * `subscription_id`, which 404'd for a user who had none. Filtering by `user_id` instead makes the
 * endpoint answer an empty page like its siblings — and without this index that query would be a scan
 * on an append-only table, so the index is part of the fix rather than an optimisation after it.
 */
@Index('idx_subscription_event_user_created', ['userId', 'createdAt'])
export class SubscriptionEvent extends QalamAppendOnlyEntity {
  @Column({ type: 'uuid' })
  subscriptionId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 40 })
  type!: SubscriptionEventType;

  @Column({ type: 'varchar', length: 40, nullable: true })
  fromTier!: PlanTier | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  toTier!: PlanTier | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  fromStatus!: SubscriptionStatus | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  toStatus!: SubscriptionStatus | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
