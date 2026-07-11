import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

import { AppealsService } from './appeals.service';
import { CreateAppealDto } from './dto/appeal.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { AppealDto, ReportDto } from './dto/moderation-response.dto';
import { ModerationService } from './moderation.service';

/**
 * User-facing intake for the moderation system: any authenticated user files a
 * report; the moderated subject files an appeal. Authenticated by the global
 * `JwtAuthGuard` (no special permission); write-tier rate limited.
 */
@ApiTags('moderation')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(RateLimitGuard)
export class ReportsController {
  constructor(
    private readonly moderation: ModerationService,
    private readonly appeals: AppealsService,
  ) {}

  @Post()
  @RateLimit('write')
  @ApiOperation({ summary: 'Report a piece, comment, response, or user.' })
  @ApiCreatedResponse({ type: ReportDto })
  create(
    @Body() body: CreateReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportDto> {
    return this.moderation.createReport(user.id, body);
  }

  @Post(':id/appeal')
  @RateLimit('write')
  @ApiOperation({ summary: 'Appeal the decision on a resolved report (subject only).' })
  @ApiCreatedResponse({ type: AppealDto })
  appeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateAppealDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AppealDto> {
    return this.appeals.createAppeal(id, user.id, body);
  }
}
