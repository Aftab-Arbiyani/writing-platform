import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, PieceStatus, UserStatus } from '@qalam/shared';
import type { Request, Response } from 'express';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { AuditQueryDto } from '../audit/dto/audit-log.dto';
import { AuthService } from '../auth/auth.service';
import type { TokenContext } from '../auth/services/token.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import { AnalyticsService } from '../analytics/analytics.service';
import { PiecesService } from '../pieces/pieces.service';
import { ProfileService } from '../users/profile.service';
import { RolesService } from '../users/roles.service';
import { UsersService } from '../users/users.service';
import { ADMIN_EXPORT_BATCH, ADMIN_RECENT_ACTIVITY_LIMIT } from './admin.constants';
import { AdminSelfActionException } from './admin.exceptions';
import {
  EXPORT_COLUMNS,
  projectFields,
  toAdminUserFilters,
  toExportRow,
  toListItem,
} from './admin-user.mapper';
import { csvLine } from './csv.util';
import { AdminActionReasonDto } from './dto/admin-user-action.dto';
import { AdminUserListQueryDto, ExportUsersQueryDto } from './dto/admin-user-query.dto';
import {
  AdminActionResultDto,
  AdminLoginHistoryDto,
  AdminUserActivityDto,
  AdminUserDetailDto,
  AdminUserListItemDto,
  AdminUserStatisticsDto,
} from './dto/admin-user-response.dto';
import { BulkActionResultDto, BulkUserActionDto } from './dto/bulk-action.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

const LOGIN_HISTORY_NOTE =
  'Qalam persists only the last successful login (users.last_login_at). Failed attempts, ' +
  'devices, and IP addresses are not stored (they exist only as ephemeral logs / expiring ' +
  'Redis sessions), so those arrays are intentionally empty.';

const ACTIVITY_NOTE =
  'Recent logins reflect the last successful login only; comment activity is not aggregated ' +
  'here. Moderation and account events come from the audit trail.';

/**
 * Admin user management (Epic E12.5) — the missing backend surface behind the
 * Admin app's A4 module. This controller is **orchestration only** (docs 16
 * §3.6): every endpoint delegates to existing/extended domain services
 * (`UsersService`, `ProfileService`, `RolesService`, `PiecesService`,
 * `AuthService`, `AnalyticsService`) and records privileged mutations through
 * the shared `AuditService`. No business logic lives here.
 *
 * Authorization: the global `JwtAuthGuard` authenticates; PBAC `@Permissions`
 * gate each route to `user.*` capabilities (held by `admin` + `super_admin`
 * only — moderators have no user grants), so there is no public access. The
 * global `RateLimitGuard` applies the declared tier.
 */
@ApiTags('admin-users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(RateLimitGuard)
export class AdminUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly profiles: ProfileService,
    private readonly roles: RolesService,
    private readonly pieces: PiecesService,
    private readonly auth: AuthService,
    private readonly analytics: AnalyticsService,
    private readonly audit: AuditService,
  ) {}

  // ── List / search / export ────────────────────────────────────────────────

  @Get()
  @Permissions(PERMISSIONS.UserView)
  @RateLimit('read')
  @ApiOperation({
    summary: 'List users (offset pagination, search, filter, sort, column selection).',
  })
  @ApiOkResponse({ type: [AdminUserListItemDto] })
  async list(@Query() query: AdminUserListQueryDto): Promise<{
    success: true;
    data: Partial<AdminUserListItemDto>[];
    meta: { pagination: unknown };
  }> {
    const page = await this.users.adminList(toAdminUserFilters(query));
    const drafts = await this.pieces.countDraftsByAuthors(page.items.map((row) => row.id));
    const data = page.items.map((row) =>
      projectFields(toListItem(row, drafts[row.id] ?? 0), query.fields),
    );
    return { success: true, data, meta: { pagination: page.meta } };
  }

  @Get('export')
  @Permissions(PERMISSIONS.UserView)
  @RateLimit('read')
  @ApiOperation({ summary: 'Stream all matching users as CSV or JSON (format=csv|json).' })
  @ApiProduces('text/csv', 'application/json')
  @ApiOkResponse({ description: 'Streamed CSV (default) or JSON array of users.' })
  async export(
    @Query() query: ExportUsersQueryDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const filters = toAdminUserFilters(query);
    const asJson = query.format === 'json';
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="qalam-users-${stamp}.${asJson ? 'json' : 'csv'}"`,
    );

    if (asJson) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.write('[');
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.write(csvLine(EXPORT_COLUMNS));
    }

    let count = 0;
    for await (const batch of this.users.adminStream(filters, ADMIN_EXPORT_BATCH)) {
      const authorIds = batch.map((row) => row.id);
      const drafts = await this.pieces.countDraftsByAuthors(authorIds);
      for (const row of batch) {
        const record = toExportRow(row, drafts[row.id] ?? 0);
        if (asJson) {
          res.write(`${count > 0 ? ',' : ''}${JSON.stringify(record)}`);
        } else {
          res.write(csvLine(EXPORT_COLUMNS.map((column) => record[column])));
        }
        count += 1;
      }
    }

    if (asJson) {
      res.write(']');
    }
    await this.writeAudit(req, admin, AUDIT_ACTIONS.UserExport, null, {
      format: asJson ? 'json' : 'csv',
      rows: count,
      filters: describeFilters(query),
    });
    res.end();
  }

  // ── Bulk actions ────────────────────────────────────────────────────────────

  @Post('bulk-actions')
  @Permissions(PERMISSIONS.UserSuspend)
  @RateLimit('write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Apply a bulk action (verify | suspend | activate | deactivate | force_logout | export) ' +
      'to up to 200 users. Returns per-id success/failure; export returns the rows in `data`.',
  })
  @ApiOkResponse({ type: BulkActionResultDto })
  async bulk(
    @Body() dto: BulkUserActionDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<BulkActionResultDto> {
    if (dto.action === 'export') {
      const rows = await this.users.adminFindRowsByIds(dto.userIds);
      const drafts = await this.pieces.countDraftsByAuthors(rows.map((row) => row.id));
      const data = rows.map((row) => toExportRow(row, drafts[row.id] ?? 0));
      await this.writeAudit(req, admin, AUDIT_ACTIONS.UserExport, null, {
        via: 'bulk',
        rows: data.length,
        requested: dto.userIds.length,
      });
      return { action: dto.action, requested: dto.userIds.length, succeeded: [], failed: [], data };
    }

    const succeeded: string[] = [];
    const failed: BulkActionResultDto['failed'] = [];
    for (const id of dto.userIds) {
      try {
        await this.applyBulkAction(dto.action, id, admin, req);
        succeeded.push(id);
      } catch (error) {
        failed.push(describeFailure(id, error));
      }
    }
    await this.writeAudit(req, admin, AUDIT_ACTIONS.UserBulkAction, null, {
      action: dto.action,
      requested: dto.userIds.length,
      succeeded: succeeded.length,
      failed: failed.length,
      reason: dto.reason,
    });
    return { action: dto.action, requested: dto.userIds.length, succeeded, failed };
  }

  // ── Detail / statistics / activity / audit / login history ───────────────────

  @Get(':id')
  @Permissions(PERMISSIONS.UserView)
  @RateLimit('read')
  @ApiOperation({ summary: 'Full user detail: profile, statistics, moderation, audit summary.' })
  @ApiOkResponse({ type: AdminUserDetailDto })
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserDetailDto> {
    return this.loadDetail(id);
  }

  @Get(':id/statistics')
  @Permissions(PERMISSIONS.UserView)
  @RateLimit('read')
  @ApiOperation({ summary: 'User statistics (views, reads, engagement, follower/piece counts).' })
  @ApiOkResponse({ type: AdminUserStatisticsDto })
  async statistics(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserStatisticsDto> {
    const row = await this.users.adminGetRow(id);
    const [writer, drafts] = await Promise.all([
      this.analytics.getWriterAnalytics(id),
      this.pieces.countByAuthor(id, PieceStatus.Draft),
    ]);
    return {
      views: writer.totalViews,
      reads: writer.reads,
      followers: row.followersCount ?? 0,
      following: row.followingCount ?? 0,
      publishedPieces: row.piecesCount ?? 0,
      drafts,
      comments: writer.commentsReceived,
      bookmarks: writer.bookmarksReceived,
      claps: writer.clapsReceived,
      responses: writer.responsesReceived,
    };
  }

  @Get(':id/activity')
  @Permissions(PERMISSIONS.UserView)
  @RateLimit('read')
  @ApiOperation({
    summary: 'User activity: recent logins, publishing, moderation + account events.',
  })
  @ApiOkResponse({ type: AdminUserActivityDto })
  async activity(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserActivityDto> {
    const row = await this.users.adminGetRow(id);
    const [recent, drafts] = await Promise.all([
      this.audit.recentForUser(id, ADMIN_RECENT_ACTIVITY_LIMIT),
      this.pieces.countByAuthor(id, PieceStatus.Draft),
    ]);
    return {
      recentLogins: row.lastLoginAt === null ? [] : [{ at: row.lastLoginAt.toISOString() }],
      publishing: { publishedPieces: row.piecesCount ?? 0, drafts },
      moderationActivity: recent.filter((e) => e.category === 'status' || e.category === 'role'),
      accountEvents: recent.filter(
        (e) => e.category === 'security' || e.category === 'administrative',
      ),
      note: ACTIVITY_NOTE,
    };
  }

  @Get(':id/audit')
  @Permissions(PERMISSIONS.UserView)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Paginated audit trail for the user (admin/role/status/security events).',
  })
  @ApiOkResponse({ description: 'Offset-paginated list of audit entries.' })
  async auditTrail(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AuditQueryDto,
  ): Promise<{ success: true; data: unknown[]; meta: { pagination: unknown } }> {
    await this.users.adminGetRow(id);
    const actions = query.action
      ?.split(',')
      .map((action) => action.trim())
      .filter((action) => action.length > 0);
    const page = await this.audit.listForUser(id, {
      actions,
      page: query.page,
      limit: query.limit,
      offset: query.offset,
    });
    return { success: true, data: page.items, meta: { pagination: page.meta } };
  }

  @Get(':id/login-history')
  @Permissions(PERMISSIONS.UserView)
  @RateLimit('read')
  @ApiOperation({ summary: 'Login history (last successful login; see note for what is stored).' })
  @ApiOkResponse({ type: AdminLoginHistoryDto })
  async loginHistory(@Param('id', ParseUUIDPipe) id: string): Promise<AdminLoginHistoryDto> {
    const row = await this.users.adminGetRow(id);
    const last = row.lastLoginAt === null ? null : row.lastLoginAt.toISOString();
    return {
      lastLoginAt: last,
      successfulLogins: last === null ? [] : [{ at: last }],
      failedLogins: [],
      devices: [],
      ipAddresses: [],
      note: LOGIN_HISTORY_NOTE,
    };
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  @Patch(':id')
  @Permissions(PERMISSIONS.UserUpdate)
  @RateLimit('write')
  @ApiOperation({ summary: 'Update display name, role, status, and/or verification.' })
  @ApiOkResponse({ type: AdminUserDetailDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<AdminUserDetailDto> {
    const user = await this.users.adminGetAccount(id);
    const changes: Record<string, unknown> = {};

    if (dto.displayName !== undefined) {
      await this.profiles.adminUpdatePenName(id, dto.displayName);
      changes.displayName = dto.displayName;
    }
    if (dto.role !== undefined) {
      const current = await this.roles.getEffectiveRole(id);
      if (dto.role !== current) {
        if (admin.id === id) {
          throw new AdminSelfActionException('You cannot change your own role.');
        }
        const result = await this.roles.setRole(id, dto.role, admin.id);
        changes.role = result;
      }
    }
    if (dto.status !== undefined && dto.status !== user.status) {
      if (admin.id === id && dto.status !== UserStatus.Active) {
        throw new AdminSelfActionException('You cannot change your own account status.');
      }
      const result = await this.users.setStatus(id, dto.status);
      changes.status = result;
    }
    if (dto.verified !== undefined) {
      const result = await this.users.setEmailVerified(id, dto.verified);
      if (result.before !== result.after) {
        changes.verified = result;
      }
    }

    await this.writeAudit(req, admin, AUDIT_ACTIONS.UserUpdate, id, {
      changes,
      reason: dto.reason,
    });
    return this.loadDetail(id);
  }

  // ── Account actions ───────────────────────────────────────────────────────────

  @Post(':id/verify')
  @Permissions(PERMISSIONS.UserUpdate)
  @RateLimit('write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark the user as email-verified.' })
  @ApiOkResponse({ type: AdminActionResultDto })
  async verify(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
    @Body() body: AdminActionReasonDto,
  ): Promise<AdminActionResultDto> {
    const result = await this.users.setEmailVerified(id, true);
    await this.writeAudit(req, admin, AUDIT_ACTIONS.UserVerify, id, {
      ...result,
      reason: body.reason,
    });
    return {
      id,
      action: AUDIT_ACTIONS.UserVerify,
      before: String(result.before),
      after: String(result.after),
      message: result.before ? 'User was already verified.' : 'User verified.',
    };
  }

  @Post(':id/suspend')
  @Permissions(PERMISSIONS.UserSuspend)
  @RateLimit('write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspend the account and revoke all its sessions. Errors: CONFLICT (409).',
  })
  @ApiOkResponse({ type: AdminActionResultDto })
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
    @Body() body: AdminActionReasonDto,
  ): Promise<AdminActionResultDto> {
    this.assertNotSelf(admin, id, 'suspend your own account');
    const result = await this.users.setStatus(id, UserStatus.Suspended);
    await this.auth.logoutAll(id, this.tokenContext(req));
    await this.writeAudit(req, admin, AUDIT_ACTIONS.UserSuspend, id, {
      ...result,
      reason: body.reason,
    });
    return this.actionResult(id, AUDIT_ACTIONS.UserSuspend, result, 'User suspended.');
  }

  @Post(':id/unsuspend')
  @Permissions(PERMISSIONS.UserRestore)
  @RateLimit('write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lift a suspension (→ active). Errors: CONFLICT (409) if not suspended.',
  })
  @ApiOkResponse({ type: AdminActionResultDto })
  async unsuspend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
    @Body() body: AdminActionReasonDto,
  ): Promise<AdminActionResultDto> {
    const result = await this.users.setStatus(id, UserStatus.Active, {
      requireFrom: UserStatus.Suspended,
    });
    await this.writeAudit(req, admin, AUDIT_ACTIONS.UserUnsuspend, id, {
      ...result,
      reason: body.reason,
    });
    return this.actionResult(id, AUDIT_ACTIONS.UserUnsuspend, result, 'Suspension lifted.');
  }

  @Post(':id/deactivate')
  @Permissions(PERMISSIONS.UserSuspend)
  @RateLimit('write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate the account and revoke its sessions. Errors: CONFLICT (409).',
  })
  @ApiOkResponse({ type: AdminActionResultDto })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
    @Body() body: AdminActionReasonDto,
  ): Promise<AdminActionResultDto> {
    this.assertNotSelf(admin, id, 'deactivate your own account');
    const result = await this.users.setStatus(id, UserStatus.Deactivated);
    await this.auth.logoutAll(id, this.tokenContext(req));
    await this.writeAudit(req, admin, AUDIT_ACTIONS.UserDeactivate, id, {
      ...result,
      reason: body.reason,
    });
    return this.actionResult(id, AUDIT_ACTIONS.UserDeactivate, result, 'User deactivated.');
  }

  @Post(':id/reactivate')
  @Permissions(PERMISSIONS.UserRestore)
  @RateLimit('write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a deactivated account (→ active). Errors: CONFLICT (409).' })
  @ApiOkResponse({ type: AdminActionResultDto })
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
    @Body() body: AdminActionReasonDto,
  ): Promise<AdminActionResultDto> {
    const result = await this.users.setStatus(id, UserStatus.Active, {
      requireFrom: UserStatus.Deactivated,
    });
    await this.writeAudit(req, admin, AUDIT_ACTIONS.UserReactivate, id, {
      ...result,
      reason: body.reason,
    });
    return this.actionResult(id, AUDIT_ACTIONS.UserReactivate, result, 'User reactivated.');
  }

  @Post(':id/reset-password')
  @Permissions(PERMISSIONS.UserUpdate)
  @RateLimit('write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger a password-reset email for the user (reuses the auth flow).' })
  @ApiOkResponse({ type: AdminActionResultDto })
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
    @Body() body: AdminActionReasonDto,
  ): Promise<AdminActionResultDto> {
    const user = await this.users.adminGetAccount(id);
    await this.auth.forgotPassword(user.email);
    await this.writeAudit(req, admin, AUDIT_ACTIONS.UserResetPassword, id, { reason: body.reason });
    return {
      id,
      action: AUDIT_ACTIONS.UserResetPassword,
      before: null,
      after: null,
      message: 'Password-reset email sent.',
    };
  }

  @Post(':id/force-logout')
  @Permissions(PERMISSIONS.UserSuspend)
  @RateLimit('write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all of the user’s sessions (session-version bump).' })
  @ApiOkResponse({ type: AdminActionResultDto })
  async forceLogout(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
    @Body() body: AdminActionReasonDto,
  ): Promise<AdminActionResultDto> {
    this.assertNotSelf(admin, id, 'force-logout your own account');
    await this.users.adminGetAccount(id);
    await this.auth.logoutAll(id, this.tokenContext(req));
    await this.writeAudit(req, admin, AUDIT_ACTIONS.UserForceLogout, id, { reason: body.reason });
    return {
      id,
      action: AUDIT_ACTIONS.UserForceLogout,
      before: null,
      after: null,
      message: 'All sessions revoked.',
    };
  }

  // ── Private orchestration helpers ─────────────────────────────────────────────

  /** Assembles the full detail view from every contributing service. */
  private async loadDetail(id: string): Promise<AdminUserDetailDto> {
    const row = await this.users.adminGetRow(id);
    const [profile, writer, drafts, auditSummary, recentActivity] = await Promise.all([
      this.profiles.getOrCreateByUserId(id),
      this.analytics.getWriterAnalytics(id),
      this.pieces.countByAuthor(id, PieceStatus.Draft),
      this.audit.summaryForUser(id),
      this.audit.recentForUser(id, ADMIN_RECENT_ACTIVITY_LIMIT),
    ]);
    const verified = row.emailVerifiedAt !== null;
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role,
      status: row.status,
      verified,
      isPrivate: row.isPrivate ?? false,
      profile: {
        penName: profile.penName,
        bio: profile.bio,
        avatarKey: profile.avatarKey,
        coverKey: profile.coverKey,
        websiteUrl: profile.websiteUrl,
        location: profile.location,
        socialLinks: profile.socialLinks,
      },
      statistics: {
        views: writer.totalViews,
        reads: writer.reads,
        followers: row.followersCount ?? 0,
        following: row.followingCount ?? 0,
        publishedPieces: row.piecesCount ?? 0,
        drafts,
        comments: writer.commentsReceived,
        bookmarks: writer.bookmarksReceived,
        claps: writer.clapsReceived,
        responses: writer.responsesReceived,
      },
      moderation: {
        currentStatus: row.status,
        isVerified: verified,
        reports: 0,
        warnings: 0,
        statusChanges: auditSummary.byCategory.status ?? 0,
        lastActionAt: auditSummary.lastActionAt,
      },
      auditSummary,
      recentActivity,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastLoginAt: row.lastLoginAt === null ? null : row.lastLoginAt.toISOString(),
      deletedAt: row.deletedAt === null ? null : row.deletedAt.toISOString(),
    };
  }

  /** Runs a single bulk sub-action (throws on failure so the caller records it). */
  private async applyBulkAction(
    action: Exclude<BulkUserActionDto['action'], 'export'>,
    id: string,
    admin: AuthenticatedUser,
    req: Request,
  ): Promise<void> {
    switch (action) {
      case 'verify':
        await this.users.setEmailVerified(id, true);
        await this.writeAudit(req, admin, AUDIT_ACTIONS.UserVerify, id, { via: 'bulk' });
        return;
      case 'suspend':
        this.assertNotSelf(admin, id, 'suspend your own account');
        await this.users.setStatus(id, UserStatus.Suspended);
        await this.auth.logoutAll(id, this.tokenContext(req));
        await this.writeAudit(req, admin, AUDIT_ACTIONS.UserSuspend, id, { via: 'bulk' });
        return;
      case 'activate':
        await this.users.setStatus(id, UserStatus.Active);
        await this.writeAudit(req, admin, AUDIT_ACTIONS.UserReactivate, id, { via: 'bulk' });
        return;
      case 'deactivate':
        this.assertNotSelf(admin, id, 'deactivate your own account');
        await this.users.setStatus(id, UserStatus.Deactivated);
        await this.auth.logoutAll(id, this.tokenContext(req));
        await this.writeAudit(req, admin, AUDIT_ACTIONS.UserDeactivate, id, { via: 'bulk' });
        return;
      case 'force_logout':
        this.assertNotSelf(admin, id, 'force-logout your own account');
        await this.users.adminGetAccount(id);
        await this.auth.logoutAll(id, this.tokenContext(req));
        await this.writeAudit(req, admin, AUDIT_ACTIONS.UserForceLogout, id, { via: 'bulk' });
        return;
      default:
        return;
    }
  }

  private actionResult(
    id: string,
    action: string,
    result: { before: UserStatus; after: UserStatus },
    message: string,
  ): AdminActionResultDto {
    return { id, action, before: result.before, after: result.after, message };
  }

  private assertNotSelf(admin: AuthenticatedUser, id: string, what: string): void {
    if (admin.id === id) {
      throw new AdminSelfActionException(`You cannot ${what}.`);
    }
  }

  private tokenContext(req: Request): TokenContext {
    return { ip: req.ip ?? 'unknown', device: req.header('user-agent') ?? 'unknown' };
  }

  private auditContext(req: Request): AuditContext {
    return {
      ip: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
      requestId: req.header('x-request-id') ?? null,
    };
  }

  private writeAudit(
    req: Request,
    admin: AuthenticatedUser,
    action: string,
    targetId: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    return this.audit.record({
      actorId: admin.id,
      actorRole: admin.role,
      action,
      targetId,
      metadata,
      context: this.auditContext(req),
    });
  }
}

/** Compact, catalogued failure record for a bulk item. */
function describeFailure(
  id: string,
  error: unknown,
): { id: string; code: string; message: string } {
  if (error !== null && typeof error === 'object') {
    const maybe = error as { code?: unknown; message?: unknown };
    const code = typeof maybe.code === 'string' ? maybe.code : 'ERROR';
    const message = typeof maybe.message === 'string' ? maybe.message : 'Action failed.';
    return { id, code, message };
  }
  return { id, code: 'ERROR', message: 'Action failed.' };
}

/** Echoes the applied filters into the export audit metadata (no pagination noise). */
function describeFilters(query: ExportUsersQueryDto): Record<string, unknown> {
  const { page, limit, sort, fields, format, ...filters } = query;
  void page;
  void limit;
  void sort;
  void fields;
  void format;
  return filters;
}
