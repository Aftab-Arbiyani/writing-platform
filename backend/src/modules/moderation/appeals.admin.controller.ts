import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';

import { AppealsService } from './appeals.service';
import { AppealFilterDto, ReviewAppealDto } from './dto/appeal.dto';
import { AppealDetailDto, AppealDto } from './dto/moderation-response.dto';
import { buildActor } from './moderation.util';

/**
 * The appeal review queue (A5). `report.review` gates reads, `report.resolve`
 * gates the decisions. Approving restores the content/user via the existing
 * lifecycle; both decisions are audited by the service.
 */
@ApiTags('admin-moderation')
@ApiBearerAuth()
@Controller('admin/appeals')
@UseGuards(RateLimitGuard)
export class AppealsAdminController {
  constructor(private readonly appeals: AppealsService) {}

  @Get()
  @Permissions(PERMISSIONS.ReportReview)
  @RateLimit('read')
  @ApiOperation({ summary: 'List the appeal queue (offset pagination, status filter).' })
  @ApiOkResponse({ type: [AppealDto] })
  async list(@Query() query: AppealFilterDto): Promise<{
    success: true;
    data: AppealDto[];
    meta: { pagination: unknown };
  }> {
    const page = await this.appeals.listAppeals(query);
    return { success: true, data: page.items, meta: { pagination: page.meta } };
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ReportReview)
  @RateLimit('read')
  @ApiOperation({ summary: 'Appeal detail: the appeal, its report, and the combined timeline.' })
  @ApiOkResponse({ type: AppealDetailDto })
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<AppealDetailDto> {
    return this.appeals.getAppeal(id);
  }

  @Post(':id/approve')
  @Permissions(PERMISSIONS.ReportResolve)
  @RateLimit('write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve the appeal and restore the content/user.' })
  @ApiOkResponse({ type: AppealDto })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewAppealDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<AppealDto> {
    return this.appeals.approve(id, body, buildActor(user, req));
  }

  @Post(':id/reject')
  @Permissions(PERMISSIONS.ReportResolve)
  @RateLimit('write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject the appeal; the decision stands.' })
  @ApiOkResponse({ type: AppealDto })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewAppealDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<AppealDto> {
    return this.appeals.reject(id, body, buildActor(user, req));
  }
}
