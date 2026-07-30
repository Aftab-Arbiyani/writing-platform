import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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

import { WarningDto } from './dto/moderation-response.dto';
import { WarnUserDto } from './dto/warn-user.dto';
import { ModerationService } from './moderation.service';
import { buildActor } from './moderation.util';

/**
 * User-directed moderation actions that aren't account state (warnings). Suspend /
 * ban reuse the E12.5 `/admin/users/:id/suspend` endpoint (or a report resolution).
 * Namespaced under `admin/moderation` to stay clear of the admin-users controller.
 */
@ApiTags('admin-moderation')
@ApiBearerAuth()
@Controller('admin/moderation/users')
@UseGuards(RateLimitGuard)
export class ModerationUsersController {
  constructor(private readonly moderation: ModerationService) {}

  @Post(':id/warn')
  @Permissions(PERMISSIONS.ReportResolve)
  @RateLimit('write')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Issue a formal warning to a user.' })
  @ApiCreatedResponse({ type: WarningDto })
  warn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: WarnUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<WarningDto> {
    return this.moderation.warnUser(id, body, buildActor(user, req));
  }

  @Get(':id/warnings')
  @Permissions(PERMISSIONS.ReportReview)
  @RateLimit('read')
  @ApiOperation({ summary: "List a user's warnings (most recent first)." })
  @ApiOkResponse({ type: [WarningDto] })
  warnings(@Param('id', ParseUUIDPipe) id: string): Promise<WarningDto[]> {
    return this.moderation.listWarnings(id);
  }
}
