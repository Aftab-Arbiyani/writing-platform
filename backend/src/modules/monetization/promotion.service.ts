import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BillingInterval,
  PlanTier,
  PromotionType,
  couponRedeemableAt,
  normalizeCouponCode,
} from '@qalam/shared';
import { DataSource, Repository } from 'typeorm';

import { Coupon } from './entities/coupon.entity';
import { PromotionRedemption } from './entities/promotion-redemption.entity';
import {
  CouponAlreadyRedeemedException,
  CouponCodeTakenException,
  CouponNotFoundException,
  CouponNotRedeemableException,
} from './monetization.exceptions';

/** The outcome of validating a coupon (preview, before redeeming). */
export interface CouponValidation {
  coupon: Coupon;
  discountedAmount: number | null;
  description: string;
}

/** Fields to create/update a coupon (admin). */
export interface CouponInput {
  code: string;
  type: PromotionType;
  value: number;
  currency?: string | null;
  appliesToTier?: PlanTier | null;
  appliesToInterval?: BillingInterval | null;
  maxRedemptions?: number;
  perUserLimit?: number;
  campaign?: string | null;
  description?: string | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
}

/**
 * The Promotion service (AF5) — coupon codes, discount campaigns, referral rewards, trial
 * extensions, promotional credits, launch/admin promos. Validation is pure (window +
 * caps + applicability); redemption is TRANSACTIONAL — it locks the coupon row, re-checks
 * the total + per-user caps, increments the counter, and writes an append-only redemption,
 * so two concurrent redemptions can never exceed a limit. The benefit (discount/credits/
 * trial days) is returned for the caller (Subscription/Pricing/Credit) to apply.
 */
@Injectable()
export class PromotionService {
  constructor(
    @InjectRepository(Coupon) private readonly coupons: Repository<Coupon>,
    private readonly dataSource: DataSource,
  ) {}

  /** Find + validate a coupon for a plan/interval (throws if unusable). */
  async validate(
    code: string,
    baseAmount: number,
    tier?: PlanTier,
    interval?: BillingInterval,
  ): Promise<CouponValidation> {
    const coupon = await this.coupons.findOne({ where: { code: normalizeCouponCode(code) } });
    if (coupon === null) {
      throw new CouponNotFoundException();
    }
    if (!couponRedeemableAt(this.toRedeemable(coupon), new Date())) {
      throw new CouponNotRedeemableException();
    }
    if (coupon.appliesToTier !== null && tier !== undefined && coupon.appliesToTier !== tier) {
      throw new CouponNotRedeemableException('This code does not apply to that plan.');
    }
    if (
      coupon.appliesToInterval !== null &&
      interval !== undefined &&
      coupon.appliesToInterval !== interval
    ) {
      throw new CouponNotRedeemableException('This code does not apply to that billing period.');
    }
    return {
      coupon,
      discountedAmount: this.discountFor(coupon, baseAmount),
      description: coupon.description ?? describe(coupon),
    };
  }

  /** The discount (minor units) a coupon yields on a base amount, or null if not a discount. */
  discountFor(coupon: Coupon, baseAmount: number): number | null {
    if (coupon.type === PromotionType.PercentageDiscount) {
      return Math.min(baseAmount, Math.round((baseAmount * coupon.value) / 100));
    }
    if (coupon.type === PromotionType.FixedDiscount) {
      return Math.min(baseAmount, coupon.value);
    }
    return null;
  }

  /**
   * Redeem a coupon for a user (transactional). Throws if the coupon is unusable or the
   * user/global cap is reached. Returns the coupon + the granted benefit.
   */
  async redeem(
    userId: string,
    code: string,
    subscriptionId?: string | null,
  ): Promise<{ coupon: Coupon; benefit: number }> {
    return this.dataSource.transaction(async (manager) => {
      const coupon = await manager.findOne(Coupon, {
        where: { code: normalizeCouponCode(code) },
        lock: { mode: 'pessimistic_write' },
      });
      if (coupon === null) {
        throw new CouponNotFoundException();
      }
      if (!couponRedeemableAt(this.toRedeemable(coupon), new Date())) {
        throw new CouponNotRedeemableException();
      }
      const usedByUser = await manager.count(PromotionRedemption, {
        where: { couponId: coupon.id, userId },
      });
      if (usedByUser >= coupon.perUserLimit) {
        throw new CouponAlreadyRedeemedException();
      }
      const benefit = coupon.value;
      coupon.redemptions += 1;
      await manager.save(coupon);
      await manager.save(
        manager.create(PromotionRedemption, {
          couponId: coupon.id,
          code: coupon.code,
          userId,
          type: coupon.type,
          benefit,
          subscriptionId: subscriptionId ?? null,
          metadata: {},
        }),
      );
      return { coupon, benefit };
    });
  }

  // ── Admin CRUD ─────────────────────────────────────────────────────────────

  async create(input: CouponInput): Promise<Coupon> {
    const code = normalizeCouponCode(input.code);
    if ((await this.coupons.count({ where: { code } })) > 0) {
      throw new CouponCodeTakenException(code);
    }
    return this.coupons.save(
      this.coupons.create({
        code,
        type: input.type,
        value: input.value,
        currency: input.currency ?? null,
        appliesToTier: input.appliesToTier ?? null,
        appliesToInterval: input.appliesToInterval ?? null,
        maxRedemptions: input.maxRedemptions ?? 0,
        redemptions: 0,
        perUserLimit: input.perUserLimit ?? 1,
        active: true,
        campaign: input.campaign ?? null,
        description: input.description ?? null,
        startsAt: input.startsAt ?? null,
        expiresAt: input.expiresAt ?? null,
        metadata: {},
      }),
    );
  }

  async update(id: string, patch: Partial<CouponInput> & { active?: boolean }): Promise<Coupon> {
    const coupon = await this.coupons.findOne({ where: { id } });
    if (coupon === null) {
      throw new CouponNotFoundException();
    }
    Object.assign(coupon, {
      value: patch.value ?? coupon.value,
      active: patch.active ?? coupon.active,
      maxRedemptions: patch.maxRedemptions ?? coupon.maxRedemptions,
      perUserLimit: patch.perUserLimit ?? coupon.perUserLimit,
      description: patch.description ?? coupon.description,
      expiresAt: patch.expiresAt ?? coupon.expiresAt,
    });
    return this.coupons.save(coupon);
  }

  async list(): Promise<Coupon[]> {
    return this.coupons.find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  private toRedeemable(coupon: Coupon): {
    active: boolean;
    startsAt: string | null;
    expiresAt: string | null;
    maxRedemptions: number;
    redemptions: number;
  } {
    return {
      active: coupon.active,
      startsAt: coupon.startsAt?.toISOString() ?? null,
      expiresAt: coupon.expiresAt?.toISOString() ?? null,
      maxRedemptions: coupon.maxRedemptions,
      redemptions: coupon.redemptions,
    };
  }
}

function describe(coupon: Coupon): string {
  switch (coupon.type) {
    case PromotionType.PercentageDiscount:
      return `${coupon.value}% off`;
    case PromotionType.FixedDiscount:
      return `${coupon.value} off`;
    case PromotionType.PromotionalCredits:
      return `${coupon.value} bonus credits`;
    case PromotionType.FreeTrial:
    case PromotionType.TrialExtension:
      return `${coupon.value} extra trial days`;
    default:
      return 'Promotion applied';
  }
}
