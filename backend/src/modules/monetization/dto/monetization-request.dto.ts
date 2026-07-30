import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BillingInterval,
  COUPON_CODE_MAX,
  CREDIT_MAX_PURCHASE,
  CREDIT_MIN_PURCHASE,
  OverrideEffect,
  PaymentProvider,
  PlanTier,
  PremiumFeature,
  PromotionType,
} from '@qalam/shared';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const PAGE_SIZE_MAX = 50;

/** Cursor pagination query (opaque cursor + clamped limit). */
export class CursorQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: PAGE_SIZE_MAX, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_SIZE_MAX)
  limit?: number;
}

/** Start a subscription checkout. */
export class CreateSubscriptionDto {
  @ApiProperty({ enum: Object.values(PlanTier) })
  @IsIn(Object.values(PlanTier))
  tier!: PlanTier;

  @ApiProperty({ enum: Object.values(BillingInterval) })
  @IsIn(Object.values(BillingInterval))
  interval!: BillingInterval;

  @ApiProperty({ enum: Object.values(PaymentProvider) })
  @IsIn(Object.values(PaymentProvider))
  provider!: PaymentProvider;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(COUPON_CODE_MAX) couponCode?: string;

  @ApiPropertyOptional({ description: 'Store purchase token/receipt (Apple/Google).' })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  receipt?: string;

  @ApiPropertyOptional({ description: 'Region code for regional pricing/tax (e.g. GB).' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  region?: string;
}

/** Upgrade/downgrade or switch billing interval. */
export class ChangePlanDto {
  @ApiProperty({ enum: Object.values(PlanTier) })
  @IsIn(Object.values(PlanTier))
  tier!: PlanTier;

  @ApiProperty({ enum: Object.values(BillingInterval) })
  @IsIn(Object.values(BillingInterval))
  interval!: BillingInterval;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  atPeriodEnd?: boolean;
}

/** Cancel a subscription. */
export class CancelSubscriptionDto {
  @ApiPropertyOptional({ default: false, description: 'Cancel now vs at period end.' })
  @IsOptional()
  @IsBoolean()
  immediate?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) reason?: string;
}

/** Buy a credit pack. */
export class PurchaseCreditsDto {
  @ApiProperty({ minimum: CREDIT_MIN_PURCHASE, maximum: CREDIT_MAX_PURCHASE })
  @Type(() => Number)
  @IsInt()
  @Min(CREDIT_MIN_PURCHASE)
  @Max(CREDIT_MAX_PURCHASE)
  credits!: number;

  @ApiProperty({ enum: Object.values(PaymentProvider) })
  @IsIn(Object.values(PaymentProvider))
  provider!: PaymentProvider;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20_000) receipt?: string;
}

/** Restore purchases from a store receipt. */
export class RestorePurchasesDto {
  @ApiProperty({ enum: Object.values(PaymentProvider) })
  @IsIn(Object.values(PaymentProvider))
  provider!: PaymentProvider;

  @ApiProperty() @IsString() @MaxLength(20_000) receipt!: string;
}

/** Preview a coupon. */
export class ValidateCouponDto {
  @ApiProperty() @IsString() @MaxLength(COUPON_CODE_MAX) code!: string;

  @ApiPropertyOptional({ enum: Object.values(PlanTier) })
  @IsOptional()
  @IsIn(Object.values(PlanTier))
  tier?: PlanTier;

  @ApiPropertyOptional({ enum: Object.values(BillingInterval) })
  @IsOptional()
  @IsIn(Object.values(BillingInterval))
  interval?: BillingInterval;
}

// ── Admin DTOs ─────────────────────────────────────────────────────────────────

/** Grant/deny an entitlement override for a user (admin). */
export class GrantOverrideDto {
  @ApiProperty() @IsString() userId!: string;

  @ApiProperty({ enum: Object.values(PremiumFeature) })
  @IsIn(Object.values(PremiumFeature))
  feature!: PremiumFeature;

  @ApiProperty({ enum: Object.values(OverrideEffect) })
  @IsIn(Object.values(OverrideEffect))
  effect!: OverrideEffect;

  @ApiPropertyOptional({ description: 'ISO date the grant lapses (temporary/promotional).' })
  @IsOptional()
  @IsString()
  expiresAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) reason?: string;

  @ApiPropertyOptional({ description: 'e.g. promotional / admin / temporary.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) limit?: number;
}

/** Adjust a user's credit balance (admin). */
export class AdjustCreditsDto {
  @ApiProperty() @IsString() userId!: string;

  @ApiProperty({ description: 'Positive to grant, negative to deduct.' })
  @Type(() => Number)
  @IsInt()
  amount!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) reason?: string;
}

/** Create a coupon (admin). */
export class CreateCouponDto {
  @ApiProperty() @IsString() @MaxLength(COUPON_CODE_MAX) code!: string;

  @ApiProperty({ enum: Object.values(PromotionType) })
  @IsIn(Object.values(PromotionType))
  type!: PromotionType;

  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) value!: number;

  @ApiPropertyOptional({ enum: Object.values(PlanTier) })
  @IsOptional()
  @IsIn(Object.values(PlanTier))
  appliesToTier?: PlanTier;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxRedemptions?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) perUserLimit?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) campaign?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) description?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() expiresAt?: string;
}

/** Update a coupon (admin). */
export class UpdateCouponDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) value?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxRedemptions?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() expiresAt?: string;
}

/** Refund a payment (admin). */
export class RefundDto {
  @ApiPropertyOptional({ description: 'Amount in minor units; omit for a full refund.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) reason?: string;
}

/** Patch the cross-cutting monetization config (admin). */
export class UpdateMonetizationConfigDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) creditsPerUsd?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) trialDays?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  gracePeriodDays?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowCreditThreshold?: number;
}
