import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { decodeCursor, encodeCursor } from '../../common/pagination/cursor.util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import { BillingService } from './billing.service';
import { CreditService } from './credit.service';
import {
  CancelSubscriptionDto,
  ChangePlanDto,
  CreateSubscriptionDto,
  CursorQueryDto,
  PurchaseCreditsDto,
  RestorePurchasesDto,
  ValidateCouponDto,
} from './dto/monetization-request.dto';
import {
  CheckoutDto,
  CreditBalanceDto,
  EntitlementDecisionDto,
  EntitlementSnapshotDto,
  PlansDto,
  PurchaseDto,
  RestoreResultDto,
  SubscriptionDto,
  UsageSummaryDto,
} from './dto/monetization-response.dto';
import { EntitlementService } from './entitlement.service';
import { InvoiceService } from './invoice.service';
import { MonetizationConfigService } from './monetization.config-service';
import { MonetizationFeatureService } from './monetization.feature-service';
import {
  toCreditBalanceDto,
  toCreditTransactionDto,
  toEntitlementSnapshotDto,
  toInvoiceDto,
  toPaymentDto,
  toPurchaseDto,
  toSubscriptionDto,
  toSubscriptionEventDto,
  toUsageSummaryDto,
} from './monetization.mappers';
import { PricingService } from './pricing.service';
import { PromotionService } from './promotion.service';
import { PurchaseService } from './purchase.service';
import {
  CouponNotFoundException,
  CouponNotRedeemableException,
  ReceiptValidationFailedException,
} from './monetization.exceptions';
import { SubscriptionService } from './subscription.service';
import { UsageService } from './usage.service';

const DEFAULT_LIMIT = 20;

/**
 * The user-facing monetization surface (AF5). Every premium capability elsewhere in the
 * app validates access through the Entitlement service (exposed here at `/entitlements`);
 * these endpoints let a user manage their subscription, view usage/credits/billing, buy
 * credits, and restore store purchases. All are `billing.use`; mutating flows also assert
 * the platform flag + a tight `billing` rate tier. Payment provider work is delegated to
 * the Billing service — never touched here.
 */
@ApiTags('monetization')
@ApiBearerAuth()
@Controller('monetization')
@UseGuards(RateLimitGuard)
export class MonetizationController {
  constructor(
    private readonly feature: MonetizationFeatureService,
    private readonly subscriptions: SubscriptionService,
    private readonly billing: BillingService,
    private readonly entitlements: EntitlementService,
    private readonly usage: UsageService,
    private readonly credits: CreditService,
    private readonly purchases: PurchaseService,
    private readonly pricing: PricingService,
    private readonly promotions: PromotionService,
    private readonly invoices: InvoiceService,
    private readonly config: MonetizationConfigService,
  ) {}

  // ── Plans & entitlements ──────────────────────────────────────────────────────

  @Get('plans')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'The plan catalogue for the comparison screen.' })
  @ApiOkResponse({ type: PlansDto })
  async plans(@Query('region') region?: string): Promise<PlansDto> {
    const [plans, currency] = await Promise.all([
      this.pricing.listPlans(),
      this.pricing.currencyForRegion(region ?? null),
    ]);
    return {
      plans: plans.map((plan) => ({
        tier: plan.tier,
        name: plan.name,
        description: plan.description,
        features: [...plan.features],
        limits: plan.limits,
        monthlyCredits: plan.monthlyCredits,
        prices: plan.prices as Record<string, Record<string, number>>,
        trialDays: plan.trialDays,
      })),
      currency,
      region: region ?? null,
    };
  }

  @Get('entitlements')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('read')
  @ApiOperation({
    summary: 'The server-authoritative entitlement snapshot (client gates on this).',
  })
  @ApiOkResponse({ type: EntitlementSnapshotDto })
  async entitlementSnapshot(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EntitlementSnapshotDto> {
    return toEntitlementSnapshotDto(await this.entitlements.getSnapshot(user.id));
  }

  @Get('entitlements/:feature')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'The entitlement decision for one premium feature.' })
  @ApiOkResponse({ type: EntitlementDecisionDto })
  async entitlement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('feature') feature: string,
  ): Promise<EntitlementDecisionDto> {
    const decision = await this.entitlements.decide(user.id, feature as never);
    return {
      feature: decision.feature,
      status: decision.status,
      allowed: decision.allowed,
      reason: decision.reason,
      expiresAt: decision.expiresAt,
      remaining: decision.remaining,
      limit: decision.limit,
    };
  }

  // ── Subscription lifecycle ────────────────────────────────────────────────────

  @Get('subscription')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'The current subscription. Errors: SUBSCRIPTION_NOT_FOUND.' })
  @ApiOkResponse({ type: SubscriptionDto })
  async subscription(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionDto> {
    return toSubscriptionDto(await this.subscriptions.getByUser(user.id));
  }

  @Post('subscription')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('billing')
  @ApiOperation({
    summary:
      'Start a subscription checkout (Stripe → checkoutUrl; store → activated via receipt). ' +
      'Errors: MONETIZATION_DISABLED, SUBSCRIPTION_ALREADY_ACTIVE, PLAN_NOT_FOUND, ' +
      'PAYMENT_PROVIDER_NOT_CONFIGURED, RECEIPT_VALIDATION_FAILED.',
  })
  @ApiOkResponse({ type: CheckoutDto })
  async subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<CheckoutDto> {
    await this.feature.assertEnabled();
    const result = await this.billing.startSubscriptionCheckout({
      userId: user.id,
      tier: dto.tier,
      interval: dto.interval,
      provider: dto.provider,
      couponCode: dto.couponCode,
      receipt: dto.receipt,
      region: dto.region ?? null,
    });
    return {
      subscription: toSubscriptionDto(result.subscription),
      checkoutUrl: result.checkoutUrl,
      clientSecret: result.clientSecret,
    };
  }

  @Post('subscription/change')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('billing')
  @ApiOperation({ summary: 'Upgrade (immediate) / downgrade or switch interval (scheduled).' })
  @ApiOkResponse({ type: SubscriptionDto })
  async changePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePlanDto,
  ): Promise<SubscriptionDto> {
    await this.feature.assertEnabled();
    return toSubscriptionDto(
      await this.subscriptions.changePlan(
        user.id,
        dto.tier,
        dto.interval,
        dto.atPeriodEnd ?? false,
      ),
    );
  }

  @Post('subscription/cancel')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('billing')
  @ApiOperation({ summary: 'Cancel now or at period end.' })
  @ApiOkResponse({ type: SubscriptionDto })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelSubscriptionDto,
  ): Promise<SubscriptionDto> {
    return toSubscriptionDto(await this.subscriptions.cancel(user.id, dto.immediate ?? false));
  }

  @Post('subscription/reactivate')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('billing')
  @ApiOperation({ summary: 'Undo a pending cancellation.' })
  @ApiOkResponse({ type: SubscriptionDto })
  async reactivate(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionDto> {
    return toSubscriptionDto(await this.subscriptions.reactivate(user.id));
  }

  @Post('subscription/pause')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('billing')
  @ApiOperation({ summary: 'Pause an active subscription.' })
  @ApiOkResponse({ type: SubscriptionDto })
  async pause(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionDto> {
    return toSubscriptionDto(await this.subscriptions.pause(user.id));
  }

  @Post('subscription/resume')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('billing')
  @ApiOperation({ summary: 'Resume a paused subscription.' })
  @ApiOkResponse({ type: SubscriptionDto })
  async resume(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionDto> {
    return toSubscriptionDto(await this.subscriptions.resume(user.id));
  }

  @Get('subscription/history')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'Subscription lifecycle history (cursor-paginated).' })
  async history(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorQueryDto) {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const rows = await this.subscriptions.listHistory(user.id, decodeCursor(query.cursor), limit);
    return page(rows, limit, toSubscriptionEventDto);
  }

  // ── Usage & credits ─────────────────────────────────────────────────────────

  @Get('usage')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'AI usage rollups (daily/monthly/lifetime) + forecast.' })
  @ApiOkResponse({ type: UsageSummaryDto })
  async usageSummary(@CurrentUser() user: AuthenticatedUser): Promise<UsageSummaryDto> {
    return toUsageSummaryDto(await this.usage.getSummary(user.id));
  }

  @Get('credits')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'AI credit wallet balance.' })
  @ApiOkResponse({ type: CreditBalanceDto })
  async creditBalance(@CurrentUser() user: AuthenticatedUser): Promise<CreditBalanceDto> {
    const [wallet, config] = await Promise.all([
      this.credits.getOrCreateWallet(user.id),
      this.config.getConfig(),
    ]);
    return toCreditBalanceDto(wallet, config.creditsPerUsd);
  }

  @Get('credits/transactions')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'Credit ledger (cursor-paginated).' })
  async creditTransactions(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorQueryDto) {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const rows = await this.credits.listTransactions(user.id, decodeCursor(query.cursor), limit);
    return page(rows, limit, toCreditTransactionDto);
  }

  @Post('credits/purchase')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('billing')
  @ApiOperation({
    summary:
      'Buy a credit pack via a validated store receipt (Apple/Google). ' +
      'Errors: MONETIZATION_DISABLED, RECEIPT_VALIDATION_FAILED, PURCHASE_NOT_FOUND.',
  })
  @ApiOkResponse({ type: PurchaseDto })
  async purchaseCredits(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PurchaseCreditsDto,
  ): Promise<PurchaseDto> {
    await this.feature.assertEnabled();
    if (dto.receipt === undefined || dto.receipt === '') {
      throw new ReceiptValidationFailedException('A store receipt is required to buy credits.');
    }
    const purchase = await this.purchases.fulfilStoreCreditPurchase(
      user.id,
      dto.provider,
      dto.receipt,
      dto.credits,
    );
    return toPurchaseDto(purchase);
  }

  // ── Billing history & purchases ───────────────────────────────────────────────

  @Get('invoices')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'Billing history (cursor-paginated).' })
  async invoiceHistory(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorQueryDto) {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const rows = await this.invoices.list(user.id, decodeCursor(query.cursor), limit);
    return page(rows, limit, toInvoiceDto);
  }

  @Get('payments')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'Payment history (cursor-paginated).' })
  async paymentHistory(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorQueryDto) {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const rows = await this.billing.listPayments(user.id, decodeCursor(query.cursor), limit);
    return page(rows, limit, toPaymentDto);
  }

  @Get('purchases')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('read')
  @ApiOperation({ summary: 'Purchase history (cursor-paginated).' })
  async purchaseHistory(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorQueryDto) {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const rows = await this.purchases.list(user.id, decodeCursor(query.cursor), limit);
    return page(rows, limit, toPurchaseDto);
  }

  @Post('purchases/restore')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('billing')
  @ApiOperation({
    summary: 'Restore store purchases from a receipt. Errors: PURCHASE_NOT_FOUND.',
  })
  @ApiOkResponse({ type: RestoreResultDto })
  async restore(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RestorePurchasesDto,
  ): Promise<{ restored: number; providerRef: string | null; expiresAt: string | null }> {
    await this.feature.assertEnabled();
    const result = await this.purchases.restore(user.id, dto.provider, dto.receipt);
    return {
      restored: result.restored,
      providerRef: result.providerRef,
      expiresAt: result.expiresAt?.toISOString() ?? null,
    };
  }

  // ── Coupons ─────────────────────────────────────────────────────────────────

  @Post('coupons/validate')
  @Permissions(PERMISSIONS.BillingUse)
  @RateLimit('billing')
  @ApiOperation({
    summary: 'Preview a coupon before checkout (never throws — returns valid:false).',
  })
  async validateCoupon(@Body() dto: ValidateCouponDto) {
    const base =
      dto.tier !== undefined && dto.interval !== undefined
        ? await this.pricing.priceFor(dto.tier, dto.interval, 'usd').catch(() => 0)
        : 0;
    try {
      const result = await this.promotions.validate(dto.code, base, dto.tier, dto.interval);
      return {
        code: result.coupon.code,
        valid: true,
        type: result.coupon.type,
        discountedAmount: result.discountedAmount,
        description: result.description,
      };
    } catch (error) {
      if (
        error instanceof CouponNotFoundException ||
        error instanceof CouponNotRedeemableException
      ) {
        return { code: dto.code, valid: false, type: '', discountedAmount: null, description: '' };
      }
      throw error;
    }
  }
}

/** Build the paginated envelope from over-fetched (limit+1) rows with a keyset cursor. */
function page<E extends { id: string; createdAt: Date }, T>(
  rows: E[],
  limit: number,
  map: (row: E) => T,
): {
  success: true;
  data: T[];
  meta: { pagination: { nextCursor: string | null; hasMore: boolean; limit: number } };
} {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const nextCursor =
    hasMore && last !== undefined
      ? encodeCursor({ k: last.createdAt.toISOString(), id: last.id })
      : null;
  return {
    success: true,
    data: items.map(map),
    meta: { pagination: { nextCursor, hasMore, limit } },
  };
}
