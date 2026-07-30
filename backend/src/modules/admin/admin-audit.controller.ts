import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { Request, Response } from 'express';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AuditService } from '../audit/audit.service';
import type { AuditAdminFilters } from '../audit/audit.repository';
import { AuditLogDto, AuditStatisticsDto } from '../audit/dto/audit-log.dto';
import { Permissions } from '../permissions/permissions.decorator';

import { csvLine } from './csv.util';
import { AdminAuditQueryDto, AuditExportQueryDto } from './dto/audit-admin.dto';

const EXPORT_BATCH = 1000;

const AUDIT_EXPORT_COLUMNS = [
  'id',
  'action',
  'category',
  'actorId',
  'actorRole',
  'targetType',
  'targetId',
  'ip',
  'requestId',
  'createdAt',
  'metadata',
] as const;

function auditExportRow(entry: AuditLogDto): Record<string, string | null> {
  return {
    id: entry.id,
    action: entry.action,
    category: entry.category,
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    targetType: entry.targetType,
    targetId: entry.targetId,
    ip: entry.ip,
    requestId: entry.requestId,
    createdAt: entry.createdAt,
    metadata: JSON.stringify(entry.metadata),
  };
}

function toFilters(query: AdminAuditQueryDto): AuditAdminFilters {
  return {
    action: query.action,
    module: query.module,
    actorId: query.actorId,
    targetType: query.targetType,
    targetId: query.targetId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    q: query.q,
    sort: query.sort,
    offset: query.offset,
    limit: query.limit,
  };
}

/**
 * Admin Audit-Log browser (E12.7) — a read/export view over the shared, append-
 * only `audit_logs`. Orchestrates the (extended) `AuditService`; owns no logic.
 * Gated on `admin.dashboard` (admin+ — audit oversight is not a moderator scope).
 */
@ApiTags('admin-audit')
@ApiBearerAuth()
@Controller('admin/audit-logs')
@UseGuards(RateLimitGuard)
export class AdminAuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Browse the audit trail (offset pagination, filter, search, sort, date range).',
  })
  @ApiOkResponse({ type: [AuditLogDto] })
  async list(@Query() query: AdminAuditQueryDto): Promise<{
    success: true;
    data: AuditLogDto[];
    meta: { pagination: unknown };
  }> {
    const page = await this.audit.adminList(toFilters(query), query.page);
    return { success: true, data: page.items, meta: { pagination: page.meta } };
  }

  @Get('statistics')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Audit statistics: actions today/week/month, top actions, most active actors.',
  })
  @ApiOkResponse({ type: AuditStatisticsDto })
  statistics(): Promise<AuditStatisticsDto> {
    return this.audit.statistics();
  }

  @Get('export')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Stream all matching audit entries as CSV or JSON (format=csv|json).' })
  @ApiProduces('text/csv', 'application/json')
  @ApiOkResponse({ description: 'Streamed CSV (default) or JSON array of audit entries.' })
  async export(
    @Query() query: AuditExportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const asJson = query.format === 'json';
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="qalam-audit-${stamp}.${asJson ? 'json' : 'csv'}"`,
    );
    if (asJson) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.write('[');
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.write(csvLine(AUDIT_EXPORT_COLUMNS));
    }

    let count = 0;
    for await (const batch of this.audit.exportStream(toFilters(query), EXPORT_BATCH)) {
      for (const entry of batch) {
        const row = auditExportRow(entry);
        if (asJson) {
          res.write(`${count > 0 ? ',' : ''}${JSON.stringify(row)}`);
        } else {
          res.write(csvLine(AUDIT_EXPORT_COLUMNS.map((column) => row[column])));
        }
        count += 1;
      }
    }
    if (asJson) {
      res.write(']');
    }
    const requestId = req.headers['x-request-id'];
    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'audit.export',
      targetId: null,
      targetType: 'audit',
      metadata: { format: asJson ? 'json' : 'csv', rows: count },
      context: {
        ip: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
        requestId: typeof requestId === 'string' ? requestId : null,
      },
    });
    res.end();
  }

  @Get(':id')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary: 'One audit entry: action, actor, target, before/after values, timestamp, ip.',
  })
  @ApiOkResponse({ type: AuditLogDto })
  async detail(@Param('id', ParseUUIDPipe) id: string): Promise<AuditLogDto> {
    const entry = await this.audit.getById(id);
    if (entry === null) {
      throw new NotFoundException('No such audit entry.');
    }
    return entry;
  }
}
