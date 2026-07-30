import { Column, Entity, Index } from 'typeorm';
import type { PromotionType } from '@qalam/shared';

import { QalamAppendOnlyEntity } from '../../../common/base/append-only.entity';

/**
 * A record that a user redeemed a coupon (AF5) — append-only. Powers the per-user
 * redemption-cap check (`perUserLimit`) and the promotion analytics. One row per
 * redemption; the (couponId, userId) pair is counted, not unique (perUserLimit may be
 * > 1). `benefit` records what was granted (discount cents / credits / trial days).
 */
@Entity('promotion_redemptions')
@Index('idx_promo_redemption_coupon_user', ['couponId', 'userId'])
@Index('idx_promo_redemption_user', ['userId'])
export class PromotionRedemption extends QalamAppendOnlyEntity {
  @Column({ type: 'uuid' })
  couponId!: string;

  @Column({ type: 'varchar', length: 40 })
  code!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 40 })
  type!: PromotionType;

  /** What the user got: discount minor units, credit count, or trial days (per `type`). */
  @Column({ type: 'int', default: 0 })
  benefit!: number;

  @Column({ type: 'uuid', nullable: true })
  subscriptionId!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
