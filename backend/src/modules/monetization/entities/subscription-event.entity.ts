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
