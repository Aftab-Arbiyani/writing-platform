import { Column, Entity, Index } from 'typeorm';
import type { BillingInterval, PlanTier, PromotionType } from '@qalam/shared';

import { QalamBaseEntity } from '../../../common/base/base.entity';

/**
 * A coupon / promotion code (AF5). Mutable because `redemptions` increments and admins
 * toggle `active`. `campaign` groups codes into a discount campaign / launch promo /
 * referral program. `value` is interpreted by `type` (percentage = 0–100, fixed =
 * minor units, credits = credit count, trial days = day count). Redemption is enforced
 * transactionally by the Promotion service (maxRedemptions + perUserLimit).
 */
@Entity('coupons')
@Index('uq_coupon_code', ['code'], { unique: true })
@Index('idx_coupon_campaign', ['campaign'])
export class Coupon extends QalamBaseEntity {
  /** Normalized (upper-cased) code. */
  @Column({ type: 'varchar', length: 40 })
  code!: string;

  @Column({ type: 'varchar', length: 40 })
  type!: PromotionType;

  /** Interpreted by `type` (percent 0–100 / fixed cents / credit count / trial days). */
  @Column({ type: 'int', default: 0 })
  value!: number;

  @Column({ type: 'varchar', length: 8, nullable: true })
  currency!: string | null;

  /** Restrict to a plan tier (null = any). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  appliesToTier!: PlanTier | null;

  /** Restrict to a billing interval (null = any). */
  @Column({ type: 'varchar', length: 20, nullable: true })
  appliesToInterval!: BillingInterval | null;

  /** 0 = unlimited total redemptions. */
  @Column({ type: 'int', default: 0 })
  maxRedemptions!: number;

  @Column({ type: 'int', default: 0 })
  redemptions!: number;

  /** Per-user redemption cap (default 1). */
  @Column({ type: 'int', default: 1 })
  perUserLimit!: number;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  campaign!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
