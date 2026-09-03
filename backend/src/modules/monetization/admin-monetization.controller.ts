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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { Request } from 'express';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { decodeCursor } from '../../common/pagination/cursor.util';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import { buildActor } from '../settings/settings.util';
import { UserNotFoundException } from '../users/exceptions/users.exceptions';
import { UsersService } from '../users/users.service';
import { BillingService } from './billing.service';
import {
  CreateCouponDto,
  CursorQueryDto,
  GrantOverrideDto,
  RefundDto,
  UpdateCouponDto,
  UpdateMonetizationConfigDto,
} from './dto/monetization-request.dto';
import { AdminUserSubscriptionDto } from './dto/monetization-response.dto';
import { EntitlementService } from './entitlement.service';
import { MONETIZATION_AUDIT_ACTIONS, MONETIZATION_AUDIT_TARGET } from './monetization.constants';
import { MonetizationAnalyticsService } from './monetization-analytics.service';
import { MonetizationConfigService } from './monetization.config-service';
import { page } from './monetization.controller';
import {
  toCouponDto,
  toEntitlementOverrideDto,
  toPaymentDto,
  toSubscriptionDto,
} from './monetization.mappers';
import { PromotionService } from './promotion.service';
import { SubscriptionService } from './subscription.service';

/** Page size when the caller does not ask — the same default the user-facing ledgers use. */
const DEFAULT_PAGE_LIMIT = 20;

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
    private readonly billing: BillingService,
    private readonly subscriptionService: SubscriptionService,
    private readonly config: MonetizationConfigService,
    private readonly analytics: MonetizationAnalyticsService,
    private readonly audit: AuditService,
    private readonly users: UsersService,
  ) {}

  /**
   * Refuses an id that belongs to nobody, so a per-account read can answer "no billing" and
   * "no such account" differently (docs/48 §3.22a, **B8-1**). Four reads need it, across four
   * services, so it lives here as one injection rather than four — the same reason the audit
   * `record()` helper below is a controller concern.
   *
   * ~~**Reads only, and that bound is deliberate rather than sufficient.**~~ **B8-2 CLOSED
   * 2026-08-31 — the writes are covered now too, and the three answers really were different:**
   *
   * - **`POST overrides`** takes a `userId` in the BODY, so a mistyped id is unverifiable by
   *   the route itself, and it asserts. Granting against nobody used to insert a row that can
   *   never apply and that no screen can list (there is no cross-account override read).
   *   (`POST credits/adjust` was the other half of this pair and had a worse failure — `grant`
   *   MATERIALISED a wallet for nobody. D5 removed the route entirely.)
   * - **`POST payments/:id/refund` deliberately does NOT assert**, and that is the point of having
   *   asked per-write: it is keyed by a PAYMENT id, and a payment that exists already carries a real
   *   `userId`. Resolving it proves the account, so a second lookup would be a redundant query
   *   answering a question the path has already answered.
   *
   * **The FK question is answered NO, on evidence rather than on effort.** All **12** monetization
   * entities declare **zero** relations and **10** carry a bare `uuid userId` — "no FK to users" is
   * this module's convention, not an oversight in this one table. An FK on `entitlement_overrides`
   * alone would need a lock-taking `ALTER` on a populated table, would leave this table inconsistent
   * with eleven siblings, and would still not protect the other nine. Validating at the write path
   * costs one query on an admin-only route, needs no migration, and is the same answer for every
   * table that ever needs it.
   */
  private async assertUserExists(userId: string): Promise<void> {
    if ((await this.users.findById(userId)) === null) {
      throw new UserNotFoundException();
    }
  }

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
  @ApiOperation({
    summary: "A user's active entitlement overrides. Errors: USER_NOT_FOUND.",
  })
  async listOverrides(@Param('userId', ParseUUIDPipe) userId: string) {
    await this.assertUserExists(userId);
    return (await this.entitlements.listOverrides(userId)).map(toEntitlementOverrideDto);
  }

  @Post('overrides')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('write')
  @ApiOperation({
    summary:
      'Grant/deny an entitlement override (admin/promotional/temporary). Errors: USER_NOT_FOUND.',
  })
  async grantOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body() dto: GrantOverrideDto,
  ) {
    // B8-2: the id arrives in the body, so nothing upstream has proven it belongs to anybody.
    await this.assertUserExists(dto.userId);
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

  // ── Refunds ───────────────────────────────────────────────────────────────────

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

  // ── One account (B8 — the A1 enablers) ────────────────────────────────────────

  /**
   * These three answer "show me THIS person's billing", which A1 could not: every equivalent on
   * the user-facing controller is `@CurrentUser` self-scoped, so an admin calling one reads their
   * OWN account. Each is pure plumbing over a service method that already existed — no new query,
   * no new pagination shape.
   *
   * **They are not audited, deliberately, and that is consistent rather than an oversight.** Every
   * MUTATION on this controller records through `this.record`; no READ does — not `listCoupons`,
   * not `getConfig`, not `listOverrides`, which is the closest precedent (an admin read of one
   * named user's billing-adjacent data). Auditing three reads and not the fourth would make the
   * trail's silence ambiguous. If admin reads should be audited, that is a decision for the audit
   * subsystem across every module, not a rule invented inside a monetization row.
   */

  @Get('users/:userId/subscription')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('read')
  @ApiOperation({
    summary:
      "One user's subscription, or null when they are on free. " +
      'A free account is a normal state, not a 404 — but an id that belongs to nobody is: ' +
      'Errors: USER_NOT_FOUND.',
  })
  @ApiOkResponse({ type: AdminUserSubscriptionDto })
  async userSubscription(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<AdminUserSubscriptionDto> {
    await this.assertUserExists(userId);
    const subscription = await this.subscriptionService.findByUser(userId);
    return { userId, subscription: subscription === null ? null : toSubscriptionDto(subscription) };
  }

  @Get('users/:userId/payments')
  @Permissions(PERMISSIONS.BillingManage)
  @RateLimit('read')
  @ApiOperation({
    summary:
      "One user's payment history (cursor-paginated) — the ids a refund needs. " +
      'Errors: USER_NOT_FOUND.',
  })
  async userPayments(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: CursorQueryDto,
  ) {
    await this.assertUserExists(userId);
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const rows = await this.billing.listPayments(userId, decodeCursor(query.cursor), limit);
    return page(rows, limit, toPaymentDto);
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
