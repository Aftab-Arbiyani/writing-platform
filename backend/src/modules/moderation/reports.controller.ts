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
  /*
   * The refusals are named because a client written from the contract alone could not discover them
   * (**W7b-1**, docs/48 §3.15). W7b's first browser run filed two of five report cases against the
   * shared seeded writer's own piece, got the 422, and failed — and the dialog sat on a spinner,
   * which is exactly how a real reader would meet it if the refusal were not surfaced. The tests were
   * wrong, not the code; what was missing was any statement that the rule exists.
   *
   * All three `createReport` can raise, not just the one that bit: 422 `REPORT_SELF` (your own content
   * or account), 404 `REPORT_TARGET_NOT_FOUND`, 409 `REPORT_DUPLICATE` (you already have an open
   * report for this).
   */
  @ApiOperation({
    summary:
      'Report a piece, comment, response, or user. ' +
      'Errors: REPORT_SELF (422 — you cannot report your own content or account), ' +
      'REPORT_TARGET_NOT_FOUND (404), REPORT_DUPLICATE (409 — an open report already exists).',
  })
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
