import { ApiProperty } from '@nestjs/swagger';

/** A user's subscription (`GET /monetization/subscription`). */
export class SubscriptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() tier!: string;
  @ApiProperty() status!: string;
  @ApiProperty() interval!: string;
  @ApiProperty() provider!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() autoRenew!: boolean;
  @ApiProperty() cancelAtPeriodEnd!: boolean;
  @ApiProperty({ nullable: true, type: String }) currentPeriodStart!: string | null;
  @ApiProperty({ nullable: true, type: String }) currentPeriodEnd!: string | null;
  @ApiProperty({ nullable: true, type: String }) trialEnd!: string | null;
  @ApiProperty({ nullable: true, type: String }) gracePeriodEnd!: string | null;
  @ApiProperty({ nullable: true, type: String }) canceledAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) scheduledTier!: string | null;
  @ApiProperty({ nullable: true, type: String }) scheduledInterval!: string | null;
  @ApiProperty() createdAt!: string;
}

/** The result of starting a checkout. */
export class CheckoutDto {
  @ApiProperty({ type: SubscriptionDto }) subscription!: SubscriptionDto;
  @ApiProperty({ nullable: true, type: String }) checkoutUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) clientSecret!: string | null;
}

/** One subscription history event. */
export class SubscriptionEventDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty({ nullable: true, type: String }) fromTier!: string | null;
  @ApiProperty({ nullable: true, type: String }) toTier!: string | null;
  @ApiProperty({ nullable: true, type: String }) fromStatus!: string | null;
  @ApiProperty({ nullable: true, type: String }) toStatus!: string | null;
  @ApiProperty() createdAt!: string;
}

/** One feature's entitlement decision. */
export class EntitlementDecisionDto {
  @ApiProperty() feature!: string;
  @ApiProperty() status!: string;
  @ApiProperty() allowed!: boolean;
  @ApiProperty() reason!: string;
  @ApiProperty({ nullable: true, type: String }) expiresAt!: string | null;
  @ApiProperty({ nullable: true, type: Number }) remaining!: number | null;
  @ApiProperty({ nullable: true, type: Number }) limit!: number | null;
}

/** The full entitlement snapshot. */
export class EntitlementSnapshotDto {
  @ApiProperty() tier!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: [EntitlementDecisionDto] }) features!: EntitlementDecisionDto[];
  @ApiProperty({ nullable: true, type: String }) refreshAt!: string | null;
}

/** A usage roll-up over one window. */
export class UsageWindowDto {
  @ApiProperty() window!: string;
  @ApiProperty() tokens!: number;
  @ApiProperty() credits!: number;
  @ApiProperty() requests!: number;
  @ApiProperty() costUsd!: number;
  @ApiProperty({ nullable: true, type: Number }) tokenLimit!: number | null;
  @ApiProperty({ nullable: true, type: Number }) creditLimit!: number | null;
  @ApiProperty({ nullable: true, type: Number }) usedFraction!: number | null;
  @ApiProperty({ nullable: true, type: String }) resetsAt!: string | null;
}

/** Per-feature usage line. */
export class UsageFeatureDto {
  @ApiProperty() feature!: string;
  @ApiProperty() tokens!: number;
  @ApiProperty() credits!: number;
  @ApiProperty() requests!: number;
}

/** The full usage summary + forecast. */
export class UsageSummaryDto {
  @ApiProperty({ type: UsageWindowDto }) daily!: UsageWindowDto;
  @ApiProperty({ type: UsageWindowDto }) monthly!: UsageWindowDto;
  @ApiProperty({ type: UsageWindowDto }) total!: UsageWindowDto;
  @ApiProperty({ type: [UsageFeatureDto] }) byFeature!: UsageFeatureDto[];
  @ApiProperty() forecastMonthlyTokens!: number;
  @ApiProperty() forecastMonthlyCostUsd!: number;
}

/** Credit wallet balance. */
export class CreditBalanceDto {
  @ApiProperty() balance!: number;
  @ApiProperty() lifetimeGranted!: number;
  @ApiProperty() lifetimeConsumed!: number;
  @ApiProperty() creditsPerUsd!: number;
  @ApiProperty() updatedAt!: string;
}

/** One credit-ledger entry. */
export class CreditTransactionDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() reason!: string;
  @ApiProperty() delta!: number;
  @ApiProperty() balanceAfter!: number;
  @ApiProperty({ nullable: true, type: String }) feature!: string | null;
  @ApiProperty() tokens!: number;
  @ApiProperty() costUsd!: number;
  @ApiProperty() createdAt!: string;
}

/** A billing document. */
export class InvoiceDto {
  @ApiProperty() id!: string;
  @ApiProperty() number!: string;
  @ApiProperty() status!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() subtotal!: number;
  @ApiProperty() tax!: number;
  @ApiProperty() total!: number;
  @ApiProperty({ nullable: true, type: String }) periodStart!: string | null;
  @ApiProperty({ nullable: true, type: String }) periodEnd!: string | null;
  @ApiProperty({ nullable: true, type: String }) paidAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) hostedUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) pdfUrl!: string | null;
  @ApiProperty() createdAt!: string;
}

/** A payment ledger row. */
export class PaymentDto {
  @ApiProperty() id!: string;
  @ApiProperty() provider!: string;
  @ApiProperty() method!: string;
  @ApiProperty() status!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty() createdAt!: string;
}

/** A purchase record. */
export class PurchaseDto {
  @ApiProperty() id!: string;
  @ApiProperty() kind!: string;
  @ApiProperty() status!: string;
  @ApiProperty() provider!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() creditsGranted!: number;
  @ApiProperty() createdAt!: string;
}

/** The result of restoring purchases. */
/**
 * The result of `POST /monetization/purchases/restore`.
 *
 * **Corrected in W4-2** (docs/48 §3.6). This declared `{ restored, subscription, creditsGranted }`
 * while the controller returned `{ restored, providerRef, expiresAt }` — and because the route carried
 * no `@ApiOkResponse`, the class was orphaned, so the drift was invisible: Swagger documented nothing
 * and this shape was never compared to anything. `@qalam/api-types` had copied the same wrong fields.
 * The route now declares this DTO, and `monetization-contract.spec.ts` pins all three together.
 *
 * Named `RestoreResultDto` rather than `RestorePurchasesDto` because the REQUEST DTO already owns that
 * name — two same-named classes in one module is how the orphan went unnoticed.
 */
export class RestoreResultDto {
  @ApiProperty() restored!: number;
  @ApiProperty({ nullable: true }) providerRef!: string | null;
  @ApiProperty({ nullable: true }) expiresAt!: string | null;
}

/** A plan in the public catalogue. */
export class PlanDto {
  @ApiProperty() tier!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: [String] }) features!: string[];
  @ApiProperty({ type: Object }) limits!: Record<string, number>;
  @ApiProperty() monthlyCredits!: number;
  @ApiProperty({ type: Object }) prices!: Record<string, Record<string, number>>;
  @ApiProperty() trialDays!: number;
}

/** The plan catalogue for the comparison screen. */
export class PlansDto {
  @ApiProperty({ type: [PlanDto] }) plans!: PlanDto[];
  @ApiProperty() currency!: string;
  @ApiProperty({ nullable: true, type: String }) region!: string | null;
}

/** A coupon (admin). */
export class CouponDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() type!: string;
  @ApiProperty() value!: number;
  @ApiProperty() active!: boolean;
  @ApiProperty() redemptions!: number;
  @ApiProperty({ description: '0 = unlimited total redemptions.' }) maxRedemptions!: number;
  @ApiProperty({ description: 'Per-user redemption cap.' }) perUserLimit!: number;
  @ApiProperty({ nullable: true, type: String, description: 'Tier restriction; null = any tier.' })
  appliesToTier!: string | null;
  @ApiProperty({ nullable: true, type: String }) campaign!: string | null;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty({ nullable: true, type: String }) expiresAt!: string | null;
  @ApiProperty() createdAt!: string;
}

/** The preview result for a coupon. */
export class CouponValidationDto {
  @ApiProperty() code!: string;
  @ApiProperty() valid!: boolean;
  @ApiProperty() type!: string;
  @ApiProperty({ nullable: true, type: Number }) discountedAmount!: number | null;
  @ApiProperty() description!: string;
}

/**
 * One user's subscription, read by an operator (`GET admin/monetization/users/:userId/subscription`).
 *
 * **`subscription` is nullable and that is the design, not a shortcut** (B8, closing A1-3/A1-7's
 * premise). The self-scoped `GET /monetization/subscription` throws `SUBSCRIPTION_NOT_FOUND` for a
 * user who has never subscribed, which is right for the account holder — they asked about *their*
 * subscription and there isn't one. For an operator, "this account is on free" is the platform's
 * most COMMON state, not an error, and answering 404 would make every admin client render an error
 * banner for the ordinary case. It also matches the sibling route on this controller:
 * `GET overrides/:userId` answers `[]` for a user with none rather than 404.
 *
 * The trade recorded rather than hidden: an unknown/typo'd user id is indistinguishable from a real
 * free account here, because this module holds no user table to check against (docs/48 §3, B8-1).
 */
export class AdminUserSubscriptionDto {
  @ApiProperty() userId!: string;
  @ApiProperty({ type: SubscriptionDto, nullable: true })
  subscription!: SubscriptionDto | null;
}

/**
 * One user's credit wallet, read by an operator (`GET admin/monetization/users/:userId/credits`).
 *
 * `credits` is `null` when no wallet row has ever existed — the account has never been granted or
 * spent a credit, so its effective balance is 0. Null rather than a fabricated zero-wallet because
 * there is no honest `updatedAt` for a row that does not exist, and because this route reads through
 * `CreditService.findWallet`, which does NOT create one: an admin looking at an account must not
 * write to it.
 */
export class AdminUserCreditsDto {
  @ApiProperty() userId!: string;
  @ApiProperty({ type: CreditBalanceDto, nullable: true })
  credits!: CreditBalanceDto | null;
}

/** An entitlement override (admin). */
export class EntitlementOverrideDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() feature!: string;
  @ApiProperty() effect!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty({ nullable: true, type: String }) expiresAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) reason!: string | null;
  @ApiProperty() createdAt!: string;
}
