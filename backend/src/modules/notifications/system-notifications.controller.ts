import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@qalam/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Permissions } from '../permissions/permissions.decorator';
import { CreateSystemNotificationDto, SystemNotificationDto } from './dto/system-notification.dto';
import { NotificationsService } from './notifications.service';

class ListSystemNotificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}

/**
 * Admin management of system broadcasts. Authorized by PBAC:
 * `@Permissions('notification.manage')` (held by admin + super_admin's `*`) on
 * top of the global `JwtAuthGuard` — replacing the old `@Roles(Admin)`. Creating
 * a broadcast fans it out to every eligible recipient.
 */
@ApiTags('admin-notifications')
@ApiBearerAuth()
@Controller('admin/system-notifications')
@UseGuards(RateLimitGuard)
@Permissions(PERMISSIONS.NotificationManage)
export class SystemNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  @RateLimit('write')
  @ApiOperation({ summary: 'Create a system notification and broadcast it to all eligible users.' })
  @ApiCreatedResponse({ type: SystemNotificationDto })
  create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateSystemNotificationDto,
  ): Promise<SystemNotificationDto> {
    return this.notifications.createSystemNotification(admin.id, dto);
  }

  @Get()
  @RateLimit('read')
  @ApiOperation({ summary: 'List recent system notifications (management view).' })
  @ApiOkResponse({ type: [SystemNotificationDto] })
  list(@Query() query: ListSystemNotificationsDto): Promise<SystemNotificationDto[]> {
    return this.notifications.listSystemNotifications(query.limit);
  }

  @Delete(':id')
  @RateLimit('write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Recall (soft-delete) a system notification. Errors: SYSTEM_NOTIFICATION_NOT_FOUND (404).',
  })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.notifications.deleteSystemNotification(id);
  }
}
