import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreditReason, PERMISSIONS } from '@qalam/shared';
import type { Request } from 'express';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import { buildActor } from '../settings/settings.util';
import { BillingService } from './billing.service';
import { CreditService } from './credit.service';
import {
  AdjustCreditsDto,
  CreateCouponDto,
  GrantOverrideDto,
  RefundDto,
  UpdateCouponDto,
  UpdateMonetizationConfigDto,
} from './dto/monetization-request.dto';
import { EntitlementService } from './entitlement.service';
import { MONETIZATION_AUDIT_ACTIONS, MONETIZATION_AUDIT_TARGET } from './monetization.constants';
import { MonetizationAnalyticsService } from './monetization-analytics.service';
import { MonetizationConfigService } from './monetization.config-service';
import { toCouponDto, toEntitlementOverrideDto, toPaymentDto } from './monetization.mappers';
import { PromotionService } from './promotion.service';

/**
 * The admin monetization surface (AF5) — plan/pricing config, promotions/coupons,
 * entitlement overrides, credit adjustments, refunds, and revenue/subscription/usage/
 * AI-cost analytics. Guarded by `billing.manage` (PBAC; the global JwtAuthGuard is the
 * auth floor). Every mutation is written to the shared audit trail with the request actor
 * — server-authoritative administration, mirroring the `/admin/ai/*` surface.
 */
@ApiTags('admin-monetization')
@ApiBearerAuth()
@Controller('admin/monetization')
@UseGuards(RateLimitGuard)
export class AdminMonetizationController {
  constructor(
    private readonly promotions: PromotionService,
    private readonly entitlements: EntitlementService,
    private readonly credits: CreditService,
    private readonly billing: BillingService,
    private readonly config: MonetizationConfigService,
    private readonly analytics: MonetizationAnalyticsService,
    private readonly audit: AuditService,
  ) {}

  // ── Coupons ─────────────────────────────────────────────────────────────────

  @Get('coupons')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'List coupons.' })
  async listCoupons() {
    return (await this.promotions.list()).map(toCouponDto);
  }

  @Post('coupons')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Create a coupon. Errors: COUPON_CODE_TAKEN.' })
  async createCoupon(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body() dto: CreateCouponDto,
  ) {
    const coupon = await this.promotions.create({
      code: dto.code,
      type: dto.type,
      value: dto.value,
      appliesToTier: dto.appliesToTier ?? null,
      maxRedemptions: dto.maxRedemptions,
      perUserLimit: dto.perUserLimit,
      campaign: dto.campaign ?? null,
      description: dto.description ?? null,
      expiresAt: dto.expiresAt !== undefined ? new Date(dto.expiresAt) : null,
    });
    await this.record(user, req, MONETIZATION_AUDIT_ACTIONS.CouponCreate, coupon.id, {
      code: coupon.code,
    });
    return toCouponDto(coupon);
  }

  @Patch('coupons/:id')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Update a coupon. Errors: COUPON_NOT_FOUND.' })
  async updateCoupon(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    const coupon = await this.promotions.update(id, {
      active: dto.active,
      value: dto.value,
      maxRedemptions: dto.maxRedemptions,
      description: dto.description,
      expiresAt: dto.expiresAt !== undefined ? new Date(dto.expiresAt) : undefined,
    });
    await this.record(user, req, MONETIZATION_AUDIT_ACTIONS.CouponUpdate, coupon.id, {});
    return toCouponDto(coupon);
  }

  // ── Entitlement overrides ─────────────────────────────────────────────────────

  @Get('overrides/:userId')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('read')
  @ApiOperation({ summary: "A user's active entitlement overrides." })
  async listOverrides(@Param('userId', ParseUUIDPipe) userId: string) {
    return (await this.entitlements.listOverrides(userId)).map(toEntitlementOverrideDto);
  }

  @Post('overrides')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Grant/deny an entitlement override (admin/promotional/temporary).' })
  async grantOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body() dto: GrantOverrideDto,
  ) {
    const override = await this.entitlements.grantOverride({
      userId: dto.userId,
      feature: dto.feature,
      effect: dto.effect,
      limit: dto.limit ?? null,
      expiresAt: dto.expiresAt !== undefined ? new Date(dto.expiresAt) : null,
      grantedBy: user.id,
      reason: dto.reason ?? null,
      source: dto.source ?? null,
    });
    await this.record(user, req, MONETIZATION_AUDIT_ACTIONS.EntitlementOverrideGrant, dto.userId, {
      feature: dto.feature,
      effect: dto.effect,
    });
    return toEntitlementOverrideDto(override);
  }

  @Delete('overrides/:id')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an entitlement override.' })
  async revokeOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const override = await this.entitlements.revokeOverride(id);
    await this.record(
      user,
      req,
      MONETIZATION_AUDIT_ACTIONS.EntitlementOverrideRevoke,
      override.userId,
      { overrideId: id },
    );
  }

  // ── Credits / refunds ─────────────────────────────────────────────────────────

  @Post('credits/adjust')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('write')
  @ApiOperation({ summary: "Adjust a user's credit balance (grant or deduct)." })
  async adjustCredits(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body() dto: AdjustCreditsDto,
  ) {
    const balance =
      dto.amount >= 0
        ? await this.credits.grant({
            userId: dto.userId,
            amount: dto.amount,
            reason: CreditReason.AdminAdjustment,
            metadata: { reason: dto.reason },
          })
        : await this.credits.debit({
            userId: dto.userId,
            amount: Math.abs(dto.amount),
            reason: CreditReason.AdminAdjustment,
            metadata: { reason: dto.reason },
          });
    await this.record(user, req, MONETIZATION_AUDIT_ACTIONS.CreditAdjust, dto.userId, {
      amount: dto.amount,
      reason: dto.reason,
    });
    return { userId: dto.userId, balance };
  }

  @Post('payments/:id/refund')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Refund a payment. Errors: PAYMENT_NOT_FOUND, PAYMENT_PROVIDER_ERROR.' })
  async refund(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundDto,
  ) {
    const refund = await this.billing.refund(id, buildActor(user, req), dto.amount, dto.reason);
    return toPaymentDto(refund);
  }

  // ── Config / plans / analytics ─────────────────────────────────────────────────

  @Get('config')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'The cross-cutting monetization config.' })
  async getConfig() {
    return this.config.getConfig();
  }

  @Patch('config')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('write')
  @ApiOperation({ summary: 'Patch the monetization config (credit rate, trial/grace, tables).' })
  async updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body() dto: UpdateMonetizationConfigDto,
  ) {
    const next = await this.config.updateConfig(dto, buildActor(user, req));
    await this.record(user, req, MONETIZATION_AUDIT_ACTIONS.ConfigUpdate, null, { patch: dto });
    return next;
  }

  @Get('plans')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'The full plan catalogue (admin view).' })
  async getPlans() {
    return this.config.getPlans();
  }

  @Get('analytics/revenue')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'Revenue analytics.' })
  async revenue() {
    return this.analytics.revenue();
  }

  @Get('analytics/subscriptions')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'Subscription + conversion analytics.' })
  async subscriptions() {
    return this.analytics.subscriptions();
  }

  @Get('analytics/usage')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'AI usage + cost analytics.' })
  async usage() {
    return this.analytics.usage();
  }

  private async record(
    user: AuthenticatedUser,
    req: Request,
    action: string,
    targetId: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const actor = buildActor(user, req);
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action,
      targetId,
      targetType: MONETIZATION_AUDIT_TARGET.Config,
      metadata,
      context: { ip: actor.ip, userAgent: actor.userAgent, requestId: actor.requestId },
    });
  }
}
