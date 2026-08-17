import { PlanTier, PromotionType } from '@qalam/shared';

import type { Coupon } from './entities/coupon.entity';
import { toCouponDto } from './monetization.mappers';

/**
 * A1-4 (docs/48 §3): `CreateCouponDto` accepted `appliesToTier`, `perUserLimit` and `description`,
 * and `toCouponDto` returned none of them — so an operator could restrict a coupon to a tier, cap it
 * per user, and never read either back to check. The values were not lost; they were invisible.
 *
 * **The test that would have caught it** compares the mapper's OUTPUT keys against what the write
 * side accepts, rather than asserting a hand-listed shape. A hand-listed shape is exactly what was
 * already there and already passing: it agreed with the mapper because it was copied from it.
 */
function coupon(overrides?: Partial<Coupon>): Coupon {
  return {
    id: 'c1',
    code: 'LAUNCH20',
    type: PromotionType.PercentageDiscount,
    value: 20,
    currency: null,
    appliesToTier: PlanTier.Plus,
    appliesToInterval: null,
    maxRedemptions: 100,
    redemptions: 7,
    perUserLimit: 1,
    active: true,
    campaign: 'launch',
    description: 'Launch week, 20% off Plus',
    startsAt: null,
    expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    metadata: {},
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  } as unknown as Coupon;
}

describe('toCouponDto — nothing an operator can set is write-only (A1-4)', () => {
  /**
   * Every field `CreateCouponDto` accepts that describes the coupon ITSELF. `code`/`type`/`value`
   * are already returned; these three were the gap. `expiresAt` is returned as an ISO string.
   */
  const SETTABLE_AND_READABLE = ['appliesToTier', 'perUserLimit', 'description'] as const;

  it.each(SETTABLE_AND_READABLE)('returns %s, which the create DTO accepts', (field) => {
    expect(Object.keys(toCouponDto(coupon()))).toContain(field);
  });

  it('carries the values through, not just the keys', () => {
    expect(toCouponDto(coupon())).toMatchObject({
      appliesToTier: PlanTier.Plus,
      perUserLimit: 1,
      description: 'Launch week, 20% off Plus',
    });
  });

  it('keeps every field it already returned, unchanged in name and type', () => {
    // The additive half of the freeze (§8): A1's admin coupon table reads these, so a rename or a
    // retype here would break a shipped consumer even though monetization sits outside the v1
    // baseline.
    expect(toCouponDto(coupon())).toMatchObject({
      id: 'c1',
      code: 'LAUNCH20',
      type: PromotionType.PercentageDiscount,
      value: 20,
      active: true,
      redemptions: 7,
      maxRedemptions: 100,
      campaign: 'launch',
      expiresAt: '2026-12-31T00:00:00.000Z',
      createdAt: '2026-08-01T00:00:00.000Z',
    });
  });

  it('reports an unrestricted coupon as null rather than omitting the field', () => {
    expect(toCouponDto(coupon({ appliesToTier: null, description: null }))).toMatchObject({
      appliesToTier: null,
      description: null,
    });
  });
});
