import { BillingInterval, PlanTier, PromotionType, normalizeCouponCode } from '@qalam/shared';
import type { DataSource, Repository } from 'typeorm';

import type { Coupon } from './entities/coupon.entity';
import type { PromotionRedemption } from './entities/promotion-redemption.entity';
import {
  CouponAlreadyRedeemedException,
  CouponNotFoundException,
  CouponNotRedeemableException,
} from './monetization.exceptions';
import { PromotionService } from './promotion.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCoupon(overrides?: Partial<Coupon>): Coupon {
  return {
    id: 'coupon-1',
    code: 'SAVE20',
    type: PromotionType.PercentageDiscount,
    value: 20,
    currency: null,
    appliesToTier: null,
    appliesToInterval: null,
    maxRedemptions: 0,
    redemptions: 0,
    perUserLimit: 1,
    active: true,
    campaign: null,
    description: null,
    startsAt: null,
    expiresAt: null,
    metadata: {},
    createdAt: new Date(),
    ...overrides,
  } as unknown as Coupon;
}

// ── Factory ────────────────────────────────────────────────────────────────────

function build(opts?: { coupon?: Coupon | null; redemptionCount?: number }) {
  const coupon = opts?.coupon !== undefined ? opts.coupon : makeCoupon();
  const redemptionCount = opts?.redemptionCount ?? 0;

  const coupons = {
    findOne: jest.fn().mockResolvedValue(coupon),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation((data: unknown) => ({ ...(data as object) })),
    save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
    find: jest.fn().mockResolvedValue([]),
  } as unknown as Repository<Coupon>;

  const fakeManager = {
    findOne: jest.fn().mockResolvedValue(coupon),
    count: jest.fn().mockResolvedValue(redemptionCount),
    save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
    create: jest.fn().mockImplementation((_E: unknown, data: unknown) => ({
      ...(data as object),
    })),
  };

  const dataSource = {
    transaction: jest
      .fn()
      .mockImplementation((cb: (mgr: typeof fakeManager) => Promise<unknown>) => cb(fakeManager)),
  } as unknown as DataSource;

  const service = new PromotionService(coupons, dataSource);
  return { service, coupons, dataSource, fakeManager };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('PromotionService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('validate', () => {
    it('should throw CouponNotFoundException for an unknown code', async () => {
      const { service } = build({ coupon: null });

      await expect(service.validate('NOTEXIST', 100)).rejects.toBeInstanceOf(
        CouponNotFoundException,
      );
    });

    it('should throw CouponNotRedeemableException for an inactive coupon', async () => {
      const { service } = build({ coupon: makeCoupon({ active: false }) });

      await expect(service.validate('SAVE20', 100)).rejects.toBeInstanceOf(
        CouponNotRedeemableException,
      );
    });

    it('should throw CouponNotRedeemableException for an expired coupon', async () => {
      const { service } = build({
        coupon: makeCoupon({ expiresAt: new Date(Date.now() - 86_400_000) }),
      });

      await expect(service.validate('SAVE20', 100)).rejects.toBeInstanceOf(
        CouponNotRedeemableException,
      );
    });

    it('should throw CouponNotRedeemableException when the coupon has not started yet', async () => {
      const { service } = build({
        coupon: makeCoupon({ startsAt: new Date(Date.now() + 86_400_000) }),
      });

      await expect(service.validate('SAVE20', 100)).rejects.toBeInstanceOf(
        CouponNotRedeemableException,
      );
    });

    it('should throw CouponNotRedeemableException when all redemptions are used', async () => {
      const { service } = build({
        coupon: makeCoupon({ maxRedemptions: 5, redemptions: 5 }),
      });

      await expect(service.validate('SAVE20', 100)).rejects.toBeInstanceOf(
        CouponNotRedeemableException,
      );
    });

    it('should throw CouponNotRedeemableException when the coupon is for a different tier', async () => {
      const { service } = build({
        coupon: makeCoupon({ appliesToTier: PlanTier.Pro }),
      });

      await expect(service.validate('SAVE20', 100, PlanTier.Plus)).rejects.toBeInstanceOf(
        CouponNotRedeemableException,
      );
    });

    it('should throw CouponNotRedeemableException when the coupon is for a different billing interval', async () => {
      const { service } = build({
        coupon: makeCoupon({ appliesToInterval: BillingInterval.Yearly }),
      });

      await expect(
        service.validate('SAVE20', 100, undefined, BillingInterval.Monthly),
      ).rejects.toBeInstanceOf(CouponNotRedeemableException);
    });

    it('should return the coupon and computed discount for a valid percentage coupon', async () => {
      const { service } = build({
        coupon: makeCoupon({ type: PromotionType.PercentageDiscount, value: 20 }),
      });

      const result = await service.validate('SAVE20', 500);

      expect(result.coupon.code).toBe('SAVE20');
      expect(result.discountedAmount).toBe(100); // 20% of 500
    });

    it('should return discountedAmount=null for a promotional-credits coupon (no discount)', async () => {
      const { service } = build({
        coupon: makeCoupon({ type: PromotionType.PromotionalCredits, value: 200 }),
      });

      const result = await service.validate('CREDITS200', 500);

      expect(result.discountedAmount).toBeNull();
    });
  });

  describe('discountFor', () => {
    it('should compute percentage discount (rounded to nearest minor unit)', () => {
      const { service } = build();
      const coupon = makeCoupon({ type: PromotionType.PercentageDiscount, value: 25 });

      const discount = service.discountFor(coupon, 400);

      expect(discount).toBe(100); // 25% of 400 = 100
    });

    it('should cap percentage discount at the base amount (cannot exceed 100%)', () => {
      const { service } = build();
      const coupon = makeCoupon({ type: PromotionType.PercentageDiscount, value: 150 }); // 150%

      const discount = service.discountFor(coupon, 300);

      expect(discount).toBe(300); // clamped to base
    });

    it('should compute a fixed discount in minor units', () => {
      const { service } = build();
      const coupon = makeCoupon({ type: PromotionType.FixedDiscount, value: 50 });

      const discount = service.discountFor(coupon, 200);

      expect(discount).toBe(50);
    });

    it('should clamp a fixed discount at the base amount', () => {
      const { service } = build();
      const coupon = makeCoupon({ type: PromotionType.FixedDiscount, value: 500 }); // exceeds base

      const discount = service.discountFor(coupon, 200);

      expect(discount).toBe(200); // clamped
    });

    it('should return null for promotional-credits and free-trial types', () => {
      const { service } = build();
      const creditsCoupon = makeCoupon({ type: PromotionType.PromotionalCredits, value: 100 });
      const trialCoupon = makeCoupon({ type: PromotionType.FreeTrial, value: 14 });

      expect(service.discountFor(creditsCoupon, 500)).toBeNull();
      expect(service.discountFor(trialCoupon, 500)).toBeNull();
    });
  });

  describe('redeem', () => {
    it('should throw CouponNotFoundException inside the transaction when the coupon is missing', async () => {
      const { service, fakeManager } = build({ coupon: makeCoupon() });
      fakeManager.findOne.mockResolvedValue(null); // TX-level miss

      await expect(service.redeem('u1', 'SAVE20')).rejects.toBeInstanceOf(CouponNotFoundException);
    });

    it('should throw CouponNotRedeemableException when the coupon is inactive inside the transaction', async () => {
      const { service, fakeManager } = build();
      fakeManager.findOne.mockResolvedValue(makeCoupon({ active: false }));

      await expect(service.redeem('u1', 'SAVE20')).rejects.toBeInstanceOf(
        CouponNotRedeemableException,
      );
    });

    it('should throw CouponAlreadyRedeemedException when the user has already hit the per-user cap', async () => {
      const { service } = build({ redemptionCount: 1 }); // perUserLimit=1, already used 1

      await expect(service.redeem('u1', 'SAVE20')).rejects.toBeInstanceOf(
        CouponAlreadyRedeemedException,
      );
    });

    it('should succeed and return the coupon + benefit when redemption is allowed', async () => {
      const coupon = makeCoupon({ type: PromotionType.PromotionalCredits, value: 500 });
      const { service } = build({ coupon, redemptionCount: 0 });

      const result = await service.redeem('u1', normalizeCouponCode('save20'));

      expect(result.coupon).toBeDefined();
      expect(result.benefit).toBe(500);
    });

    it('should increment redemptions on the coupon row inside the transaction', async () => {
      const coupon = makeCoupon({ redemptions: 0 });
      const { service, fakeManager } = build({ coupon, redemptionCount: 0 });
      fakeManager.findOne.mockResolvedValue({ ...coupon }); // fresh copy in TX

      await service.redeem('u1', 'SAVE20');

      const savedCoupon = (fakeManager.save as jest.Mock).mock.calls[0]?.[0] as Coupon;
      expect(savedCoupon.redemptions).toBe(1);
    });

    it('should write a PromotionRedemption row inside the transaction', async () => {
      const coupon = makeCoupon({ redemptions: 0 });
      const { service, fakeManager } = build({ coupon, redemptionCount: 0 });
      fakeManager.findOne.mockResolvedValue({ ...coupon });

      await service.redeem('u1', 'SAVE20', 'sub-1');

      // The only manager.create call builds the PromotionRedemption row (coupon is saved directly)
      const [, redemptionData] = fakeManager.create.mock.calls[0] as [
        unknown,
        Partial<PromotionRedemption>,
      ];
      expect(redemptionData.userId).toBe('u1');
      expect(redemptionData.subscriptionId).toBe('sub-1');
    });
  });
});
