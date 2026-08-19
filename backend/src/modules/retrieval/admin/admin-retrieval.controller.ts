import { Body, Controller, Get, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, SEARCH_ANALYTICS_DEFAULT_WINDOW_DAYS } from '@qalam/shared';
import type { Request } from 'express';

import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../../permissions/permissions.decorator';
import { buildActor } from '../../settings/settings.util';
import { UpdateRetrievalConfigDto, SearchAnalyticsQueryDto } from '../dto/retrieval-request.dto';
import { RetrievalConfigDto, SearchAnalyticsDto } from '../dto/retrieval-response.dto';
import { RetrievalTelemetryService } from '../observability/retrieval-telemetry.service';
import { RetrievalConfigService } from '../retrieval-config.service';

/**
 * Admin: retrieval configuration + search analytics (AF4). Requires `ai.manage`. Search /
 * ranking / recommendation configuration is one JSON settings row edited through the AUDITED
 * settings write path (no bespoke store). Prompt management, model assignment, feature flags,
 * and per-user usage REUSE the AF1 admin surface (`/admin/ai/prompts`, `/admin/ai/config`,
 * `/admin/feature-flags`, `/admin/ai/usage/:userId`) — no duplicated admin code. Analytics is
 * internal quality signal, never exposed to end users.
 */
@ApiTags('admin-ai')
@ApiBearerAuth()
@Controller('admin/ai')
@UseGuards(RateLimitGuard)
export class AdminRetrievalController {
  constructor(
    private readonly config: RetrievalConfigService,
    private readonly telemetry: RetrievalTelemetryService,
  ) {}

  @Get('search-config')
  @Permissions(PERMISSIONS.AiManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'The effective retrieval config (sources, ranking weights, budgets).' })
  @ApiOkResponse({ type: RetrievalConfigDto })
  getConfig(): Promise<RetrievalConfigDto> {
    return this.config.getConfig();
  }

  @Put('search-config')
  @Permissions(PERMISSIONS.AiManage)
  @RateLimit('write')
  @ApiOperation({
    summary: 'Update retrieval config (partial). Audited via the settings write path.',
  })
  @ApiOkResponse({ type: RetrievalConfigDto })
  updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body() dto: UpdateRetrievalConfigDto,
  ): Promise<RetrievalConfigDto> {
    return this.config.update(dto, buildActor(user, req));
  }

  @Get('search-analytics')
  @Permissions(PERMISSIONS.AiManage)
  @RateLimit('read')
  @ApiOperation({ summary: 'Internal search-quality analytics over a trailing window.' })
  @ApiOkResponse({ type: SearchAnalyticsDto })
  analytics(@Query() query: SearchAnalyticsQueryDto): Promise<SearchAnalyticsDto> {
    return this.telemetry.getAnalytics(query.windowDays ?? SEARCH_ANALYTICS_DEFAULT_WINDOW_DAYS);
  }
}
