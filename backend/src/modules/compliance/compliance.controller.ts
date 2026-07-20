import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { Request } from 'express';

import { REQUEST_ID_HEADER } from '../../common/constants/http.constants';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { Permissions } from '../permissions/permissions.decorator';
import type { AuditContext } from '../audit/audit.service';
import { ComplianceService } from './compliance.service';
import type { ComplianceReport, FrameworkReadiness } from './compliance.service';
import type { RetentionRule } from '../privacy/privacy.constants';

/**
 * Admin Compliance surface (P7.2) — feeds the admin Compliance Dashboard.
 * Read-only; admin-gated (`admin.dashboard`). Report generation is itself
 * audited (accountability). No secrets or PII are exposed.
 */
@ApiTags('admin-compliance')
@ApiBearerAuth()
@Controller('admin/compliance')
@UseGuards(RateLimitGuard)
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('report')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({
    summary: 'Compliance report (security posture, audit activity, retention, frameworks).',
  })
  @ApiOkResponse({ description: 'Compliance report.' })
  report(@Req() req: Request): Promise<ComplianceReport> {
    const header = req.headers[REQUEST_ID_HEADER];
    const ctx: AuditContext = {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      requestId: (Array.isArray(header) ? header[0] : header) ?? null,
    };
    return this.compliance.report(ctx);
  }

  @Get('retention')
  @Permissions(PERMISSIONS.AdminDashboard)
  @RateLimit('read')
  @ApiOperation({ summary: 'Data-retention registry (category → retention → basis).' })
  @ApiOkResponse({ description: 'Retention rules.' })
  retention(): { frameworks: readonly FrameworkReadiness[]; retention: readonly RetentionRule[] } {
    return {
      frameworks: this.compliance.frameworks(),
      retention: this.compliance.retentionPolicies(),
    };
  }
}
