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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import type { Request } from 'express';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';

import { ReportFilterDto } from './dto/report-filter.dto';
import {
  AddNoteDto,
  AssignModeratorDto,
  BulkReportActionDto,
  ResolveReportDto,
  UpdatePriorityDto,
} from './dto/report-action.dto';
import {
  BulkReportResultDto,
  ReportDetailDto,
  ReportDto,
  ReportNoteDto,
} from './dto/moderation-response.dto';
import { ModerationService } from './moderation.service';
import { buildActor } from './moderation.util';

/**
 * The moderation report queue + actions (A5). `report.review` gates reads;
 * `report.resolve` gates every mutation (both held by moderator+ / admin). Every
 * mutation is audited by the service — controllers stay thin.
 */
@ApiTags('admin-moderation')
@ApiBearerAuth()
@Controller('admin/reports')
@UseGuards(RateLimitGuard)
export class ReportsAdminController {
  constructor(private readonly moderation: ModerationService) {}

  @Get()
  @Permissions(PERMISSIONS.ReportReview)
  @RateLimit('read')
  @ApiOperation({ summary: 'List the report queue (offset pagination, filters, search, sort).' })
  @ApiOkResponse({ type: [ReportDto] })
  async list(@Query() query: ReportFilterDto): Promise<{
    success: true;
    data: ReportDto[];
    meta: { pagination: unknown };
  }> {
    const page = await this.moderation.listReports(query);
    return { success: true, data: page.items, meta: { pagination: page.meta } };
  }

  @Post('bulk-actions')
  @Permissions(PERMISSIONS.ReportResolve)
  @RateLimit('write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a bulk action (approve/reject/assign/hide/restore/close).' })
  @ApiOkResponse({ type: BulkReportResultDto })
  bulk(
    @Body() body: BulkReportActionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<BulkReportResultDto> {
    return this.moderation.bulk(body, buildActor(user, req));
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ReportReview)
  @RateLimit('read')
  @ApiOperation({ summary: 'Full report detail: entity snapshot, notes, appeal, action history.' })
  @ApiOkResponse({ type: ReportDetailDto })
  report(@Param('id', ParseUUIDPipe) id: string): Promise<ReportDetailDto> {
    return this.moderation.getReport(id);
  }

  @Post(':id/assign')
  @Permissions(PERMISSIONS.ReportResolve)
  @RateLimit('write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign the report to a moderator.' })
  @ApiOkResponse({ type: ReportDto })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignModeratorDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ReportDto> {
    return this.moderation.assign(id, body, buildActor(user, req));
  }

  @Patch(':id/priority')
  @Permissions(PERMISSIONS.ReportResolve)
  @RateLimit('write')
  @ApiOperation({ summary: 'Change the report priority.' })
  @ApiOkResponse({ type: ReportDto })
  priority(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePriorityDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ReportDto> {
    return this.moderation.setPriority(id, body, buildActor(user, req));
  }

  @Post(':id/escalate')
  @Permissions(PERMISSIONS.ReportResolve)
  @RateLimit('write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Escalate the report (→ urgent, reviewing).' })
  @ApiOkResponse({ type: ReportDto })
  escalate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ReportDto> {
    return this.moderation.escalate(id, buildActor(user, req));
  }

  @Post(':id/notes')
  @Permissions(PERMISSIONS.ReportResolve)
  @RateLimit('write')
  @ApiOperation({ summary: 'Add an internal moderator note.' })
  @ApiCreatedResponse({ type: ReportNoteDto })
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddNoteDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ReportNoteDto> {
    return this.moderation.addNote(id, body, buildActor(user, req));
  }

  @Post(':id/resolve')
  @Permissions(PERMISSIONS.ReportResolve)
  @RateLimit('write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Resolve the report — the resolution drives the content/user action (hide/remove/warn/suspend/ban). Suspend/ban require admin.',
  })
  @ApiOkResponse({ type: ReportDto })
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResolveReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ReportDto> {
    return this.moderation.resolve(id, body, buildActor(user, req));
  }
}
