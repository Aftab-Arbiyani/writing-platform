import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { Request, Response } from 'express';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';

import { AnalyticsService } from './analytics.service';
import {
  AdminAnalyticsExportQueryDto,
  AdminAnalyticsQueryDto,
} from './dto/admin-analytics-query.dto';
import {
  ContentAnalyticsDto,
  EngagementAnalyticsDto,
  ModerationAnalyticsDto,
  PlatformOverviewDto,
  SystemAnalyticsDto,
  UserAnalyticsDto,
} from './dto/admin-analytics-response.dto';

/** Escapes one CSV cell (quote when it contains a comma/quote/newline). */
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Flattens a nested analytics payload into `metric,value` rows for CSV export. */
function flattenRows(data: unknown, prefix = ''): Array<[string, string]> {
  if (Array.isArray(data)) {
    return data.flatMap((item, index) => flattenRows(item, `${prefix}[${index}]`));
  }
  if (data !== null && typeof data === 'object') {
    return Object.entries(data).flatMap(([key, value]) =>
      flattenRows(value, prefix === '' ? key : `${prefix}.${key}`),
    );
  }
  return [[prefix, data === null || data === undefined ? '' : String(data)]];
}

/**
 * Admin Platform Analytics (E12.9) — platform-wide insights for administrators,
 * distinct from the writer/reader analytics on `/analytics/*`. Extends the
 * Analytics domain (all logic lives in `AnalyticsService`); this controller is
 * thin. Every endpoint requires `analytics.view` (PBAC) behind the global JWT
 * guard + the rate-limit guard. The export is audited.
 */
@ApiTags('admin-analytics')
@ApiBearerAuth()
@Controller('admin/analytics')
@UseGuards(RateLimitGuard)
export class AdminAnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly audit: AuditService,
  ) {}

  @Get('overview')
  @Permissions(PERMISSIONS.AnalyticsView)
  @RateLimit('read')
  @ApiOperation({ summary: 'Platform overview: headline counts + growth rate. Cached.' })
  @ApiOkResponse({ type: PlatformOverviewDto })
  overview(@Query() query: AdminAnalyticsQueryDto): Promise<PlatformOverviewDto> {
    return this.analytics.getOverview(query);
  }

  @Get('users')
  @Permissions(PERMISSIONS.AnalyticsView)
  @RateLimit('read')
  @ApiOperation({
    summary: 'User analytics: registrations, active/retention, DAU/WAU/MAU, top languages.',
  })
  @ApiOkResponse({ type: UserAnalyticsDto })
  users(@Query() query: AdminAnalyticsQueryDto): Promise<UserAnalyticsDto> {
    return this.analytics.getUserAnalytics(query);
  }

  @Get('content')
  @Permissions(PERMISSIONS.AnalyticsView)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Content analytics: pieces, per language/genre, reading, most viewed/shared.',
  })
  @ApiOkResponse({ type: ContentAnalyticsDto })
  content(@Query() query: AdminAnalyticsQueryDto): Promise<ContentAnalyticsDto> {
    return this.analytics.getContentAnalytics(query);
  }

  @Get('engagement')
  @Permissions(PERMISSIONS.AnalyticsView)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Engagement analytics: views, reads, claps, comments, shares, follows.',
  })
  @ApiOkResponse({ type: EngagementAnalyticsDto })
  engagement(@Query() query: AdminAnalyticsQueryDto): Promise<EngagementAnalyticsDto> {
    return this.analytics.getEngagementAnalytics(query);
  }

  @Get('moderation')
  @Permissions(PERMISSIONS.AnalyticsView)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Moderation analytics: reports, appeals, resolution, moderator activity.',
  })
  @ApiOkResponse({ type: ModerationAnalyticsDto })
  moderation(@Query() query: AdminAnalyticsQueryDto): Promise<ModerationAnalyticsDto> {
    return this.analytics.getModerationAnalytics(query);
  }

  @Get('system')
  @Permissions(PERMISSIONS.AnalyticsView)
  @RateLimit('read')
  @ApiOperation({
    summary: 'System analytics: queues/workers, cache hit ratio, DB size. Short-TTL cache.',
  })
  @ApiOkResponse({ type: SystemAnalyticsDto })
  system(): Promise<SystemAnalyticsDto> {
    return this.analytics.getSystemAnalytics();
  }

  @Get('export')
  @Permissions(PERMISSIONS.AnalyticsView)
  @RateLimit('read')
  @ApiOperation({ summary: 'Export one analytics dataset as CSV or JSON (format=csv|json).' })
  @ApiProduces('text/csv', 'application/json')
  @ApiOkResponse({ description: 'Streamed CSV (default) or JSON for the chosen dataset.' })
  async export(
    @Query() query: AdminAnalyticsExportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.analytics.getExportData(query, query.dataset);
    const asJson = query.format === 'json';
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="qalam-analytics-${query.dataset}-${stamp}.${asJson ? 'json' : 'csv'}"`,
    );

    if (asJson) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.write(JSON.stringify(data));
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.write('metric,value\n');
      for (const [metric, value] of flattenRows(data)) {
        res.write(`${csvCell(metric)},${csvCell(value)}\n`);
      }
    }

    const requestId = req.headers['x-request-id'];
    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'analytics.export',
      targetId: null,
      targetType: 'analytics',
      metadata: { dataset: query.dataset, format: asJson ? 'json' : 'csv' },
      context: {
        ip: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
        requestId: typeof requestId === 'string' ? requestId : null,
      },
    });
    res.end();
  }
}
