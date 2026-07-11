import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS, ReportStatus } from '@qalam/shared';
import type { Request, Response } from 'express';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AuditService } from '../audit/audit.service';
import { ReportDto, ReportNoteDto } from '../moderation/dto/moderation-response.dto';
import {
  ReportStatisticsDto,
  ReportTimelineEntryDto,
  ReportTrendsDto,
} from '../moderation/dto/report-stats.dto';
import { ModerationService } from '../moderation/moderation.service';
import { buildActor } from '../moderation/moderation.util';
import { Permissions } from '../permissions/permissions.decorator';

import { csvLine } from './csv.util';
import {
  ReportExportQueryDto,
  TrendsQueryDto,
  UpdateNoteDto,
  UpdateReportDto,
} from './dto/reports-admin.dto';

const EXPORT_BATCH = 500;
const DAY_MS = 86_400_000;

/** Ordered CSV columns for the report export (also the JSON row keys). */
const REPORT_EXPORT_COLUMNS = [
  'id',
  'entityType',
  'entityId',
  'reportedUserId',
  'reporterId',
  'reason',
  'status',
  'priority',
  'severity',
  'assignedModeratorId',
  'resolution',
  'resolvedAt',
  'createdAt',
  'updatedAt',
] as const;

function reportExportRow(report: ReportDto): Record<string, string | number | null> {
  return {
    id: report.id,
    entityType: report.entityType,
    entityId: report.entityId,
    reportedUserId: report.reportedUserId,
    reporterId: report.reporterId,
    reason: report.reason,
    status: report.status,
    priority: report.priority,
    severity: report.severity,
    assignedModeratorId: report.assignedModeratorId,
    resolution: report.resolution,
    resolvedAt: report.resolvedAt,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

/**
 * Admin Reports surface (E12.7) — additive report actions, timeline, statistics,
 * trends, and export. The queue (`GET /admin/reports`), detail (`GET /:id`), and
 * note creation live in the moderation module (E12.6); this controller reuses
 * `ModerationService` and never duplicates business logic. Static routes
 * (`statistics`/`trends`/`export`) resolve here because `AdminModule` is imported
 * before `ModerationModule` (whose `:id` route would otherwise capture them).
 */
@ApiTags('admin-reports')
@ApiBearerAuth()
@Controller('admin/reports')
@UseGuards(RateLimitGuard)
export class AdminReportsController {
  constructor(
    private readonly moderation: ModerationService,
    private readonly audit: AuditService,
  ) {}

  @Get('statistics')
  @Permissions(PERMISSIONS.ReportReview)
  @RateLimit('read')
  @ApiOperation({
    summary:
      'Report statistics: open/resolved, avg resolution, by category/severity, moderator performance.',
  })
  @ApiOkResponse({ type: ReportStatisticsDto })
  statistics(): Promise<ReportStatisticsDto> {
    return this.moderation.getStatistics();
  }

  @Get('trends')
  @Permissions(PERMISSIONS.ReportReview)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Report trends (created + resolved per day) over a window; defaults to 30 days.',
  })
  @ApiOkResponse({ type: ReportTrendsDto })
  trends(@Query() query: TrendsQueryDto): Promise<ReportTrendsDto> {
    const to = query.to ?? new Date().toISOString();
    const from = query.from ?? new Date(Date.now() - 30 * DAY_MS).toISOString();
    return this.moderation.getTrends(from, to);
  }

  @Get('export')
  @Permissions(PERMISSIONS.ReportReview)
  @RateLimit('read')
  @ApiOperation({ summary: 'Stream all matching reports as CSV or JSON (format=csv|json).' })
  @ApiProduces('text/csv', 'application/json')
  @ApiOkResponse({ description: 'Streamed CSV (default) or JSON array of reports.' })
  async export(
    @Query() query: ReportExportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const asJson = query.format === 'json';
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="qalam-reports-${stamp}.${asJson ? 'json' : 'csv'}"`,
    );
    if (asJson) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.write('[');
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.write(csvLine(REPORT_EXPORT_COLUMNS));
    }

    let count = 0;
    for await (const batch of this.moderation.streamReports(query, EXPORT_BATCH)) {
      for (const report of batch) {
        const row = reportExportRow(report);
        if (asJson) {
          res.write(`${count > 0 ? ',' : ''}${JSON.stringify(row)}`);
        } else {
          res.write(csvLine(REPORT_EXPORT_COLUMNS.map((column) => row[column])));
        }
        count += 1;
      }
    }
    if (asJson) {
      res.write(']');
    }
    const actor = buildActor(user, req);
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'report.export',
      targetId: null,
      targetType: 'report',
      metadata: { format: asJson ? 'json' : 'csv', rows: count },
      context: { ip: actor.ip, userAgent: actor.userAgent, requestId: actor.requestId },
    });
    res.end();
  }

  @Get(':id/timeline')
  @Permissions(PERMISSIONS.ReportReview)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Chronological report timeline: status changes, moderator actions, appeals, notes.',
  })
  @ApiOkResponse({ type: [ReportTimelineEntryDto] })
  timeline(@Param('id', ParseUUIDPipe) id: string): Promise<ReportTimelineEntryDto[]> {
    return this.moderation.getTimeline(id);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ReportResolve)
  @RateLimit('write')
  @ApiOperation({
    summary:
      'Update a report: assign / priority / resolve / close / reopen (via resolution or status).',
  })
  @ApiOkResponse({ type: ReportDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ReportDto> {
    const actor = buildActor(user, req);
    let result: ReportDto | undefined;
    if (dto.assignedModeratorId !== undefined) {
      result = await this.moderation.assign(id, { moderatorId: dto.assignedModeratorId }, actor);
    }
    if (dto.priority !== undefined) {
      result = await this.moderation.setPriority(id, { priority: dto.priority }, actor);
    }
    if (dto.resolution !== undefined) {
      result = await this.moderation.resolve(
        id,
        { resolution: dto.resolution, reason: dto.reason, severity: dto.severity },
        actor,
      );
    } else if (dto.status === ReportStatus.Reviewing || dto.status === ReportStatus.Pending) {
      result = await this.moderation.reopenReport(id, actor);
    }
    if (result === undefined) {
      throw new BadRequestException('No report fields to update.');
    }
    return result;
  }

  @Patch(':id/notes/:noteId')
  @Permissions(PERMISSIONS.ReportResolve)
  @RateLimit('write')
  @ApiOperation({ summary: 'Edit an internal note.' })
  @ApiOkResponse({ type: ReportNoteDto })
  updateNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateNoteDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ReportNoteDto> {
    return this.moderation.updateNote(id, noteId, dto.body, buildActor(user, req));
  }

  @Delete(':id/notes/:noteId')
  @Permissions(PERMISSIONS.ReportResolve)
  @RateLimit('write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an internal note.' })
  @ApiNoContentResponse()
  async deleteNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.moderation.deleteNote(id, noteId, buildActor(user, req));
  }
}
