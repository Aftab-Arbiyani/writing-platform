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
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

const PAGE_SIZE_MAX = 50;

/**
 * How many entries one config table may carry (B8, A1-2).
 *
 * `updateConfig` MERGES per key and never deletes, so without a bound a single patch could grow the
 * `monetization.config` settings row without limit — and that row is read (and Redis-cached) on
 * every priced request. The number is generous: ~250 ISO country codes and ~180 currencies exist,
 * and a real install configures a handful.
 */
const CONFIG_TABLE_MAX_ENTRIES = 64;
const CONFIG_TABLE_KEY_MAX = 16;

function entries(value: unknown): Array<[string, unknown]> {
  return value !== null && typeof value === 'object' ? Object.entries(value) : [];
}

function keysAreSane(value: unknown): boolean {
  const rows = entries(value);
  return (
    rows.length <= CONFIG_TABLE_MAX_ENTRIES &&
    rows.every(([key]) => key.length > 0 && key.length <= CONFIG_TABLE_KEY_MAX)
  );
}

/** `taxRates`: region → rate as a fraction. `TaxService` computes `amount * rate`. */
@ValidatorConstraint({ name: 'isRateTable' })
export class IsRateTable implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      keysAreSane(value) &&
      entries(value).every(
        ([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1,
      )
    );
  }

  defaultMessage(): string {
    return (
      'taxRates must map at most 64 short region keys to finite fractions between 0 and 1 ' +
      '(0.2 means 20%, not 20).'
    );
  }
}

/** `currencyRates`: currency → multiplier vs USD. `PricingService` multiplies by it. */
@ValidatorConstraint({ name: 'isCurrencyRateTable' })
export class IsCurrencyRateTable implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      keysAreSane(value) &&
      entries(value).every(([, v]) => typeof v === 'number' && Number.isFinite(v) && v > 0)
    );
  }

  defaultMessage(): string {
    return (
      'currencyRates must map at most 64 short currency keys to finite rates greater than 0 ' +
      '(a rate of 0 would price every plan at nothing).'
    );
  }
}

/** `regionCurrency`: region → currency code. `PricingService` returns it as the currency. */
@ValidatorConstraint({ name: 'isCurrencyByRegionTable' })
export class IsCurrencyByRegionTable implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      keysAreSane(value) &&
      entries(value).every(
        ([, v]) => typeof v === 'string' && v.length > 0 && v.length <= CONFIG_TABLE_KEY_MAX,
      )
    );
  }

  defaultMessage(): string {
    return 'regionCurrency must map at most 64 short region keys to non-empty currency codes.';
  }
}

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

/**
 * Patch the cross-cutting monetization config (admin).
 *
 * **All SEVEN fields, since B8.** Until then this declared the four numbers only, so
 * `ValidationPipe` (`whitelist: true`) stripped `taxRates`, `currencyRates` and `regionCurrency`
 * before the service saw them — even though `MonetizationConfigPatch` carries all three and
 * `MonetizationConfigService.updateConfig` merges each per key. The tables were readable and
 * unwritable over this route, and nothing said so (docs/48 §3, A1-2).
 *
 * The three table validators below assert exactly what the consumers already ASSUME, which is why
 * bare `@IsObject()` (the idiom elsewhere in the codebase, e.g. `retrieval-request.dto.ts:215`) is
 * not enough here: `mergeConfig` spreads values through without coercing them, so a string in
 * `taxRates` would persist and `TaxService` would then compute `amount * "20%"` — NaN tax on every
 * priced subscription, from a typo, with no error anywhere.
 */
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

  @ApiPropertyOptional({
    type: Object,
    description:
      'Region code → tax rate as a FRACTION (0.2 = 20%), plus a `default` key. Merged per key ' +
      'over the stored table; keys are never removed by a patch.',
    example: { default: 0, GB: 0.2 },
  })
  @IsOptional()
  @IsObject()
  @Validate(IsRateTable)
  taxRates?: Record<string, number>;

  @ApiPropertyOptional({
    type: Object,
    description:
      'Currency code → multiplier against USD (usd: 1). Merged per key over the stored table.',
    example: { usd: 1, gbp: 0.79 },
  })
  @IsOptional()
  @IsObject()
  @Validate(IsCurrencyRateTable)
  currencyRates?: Record<string, number>;

  @ApiPropertyOptional({
    type: Object,
    description: 'Region code → currency code. Merged per key over the stored table.',
    example: { GB: 'gbp' },
  })
  @IsOptional()
  @IsObject()
  @Validate(IsCurrencyByRegionTable)
  regionCurrency?: Record<string, string>;
}
