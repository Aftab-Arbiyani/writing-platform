import {
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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { NotificationQueryDto } from './dto/notification-query.dto';
import {
  NotificationPreferencesDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification-preferences.dto';
import { NotificationDto, UnreadCountDto } from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';

/**
 * The recipient's own inbox (E9). Authenticated by the global `JwtAuthGuard`;
 * every operation is scoped to `@CurrentUser()`, so a user can only ever read or
 * mutate their own notifications (a foreign id reads as 404). Cursor-paginated,
 * newest first (docs 05 §5.1). Thin controller (docs 16 §3.6).
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
@UseGuards(RateLimitGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  @RateLimit('read')
  @ApiOperation({
    summary: 'Your notifications, newest first. Filter by status/type; cursor-paginated.',
    description: 'Errors: FEED_INVALID_CURSOR (400).',
  })
  @ApiOkResponse({ type: [NotificationDto] })
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: NotificationQueryDto) {
    const page = await this.notifications.list(user.id, query);
    return { success: true as const, data: page.items, meta: { pagination: page.meta } };
  }

  @Get('notifications/unread-count')
  @RateLimit('read')
  @ApiOperation({ summary: 'Unread notification count (Redis-cached, capped display at 99+).' })
  @ApiOkResponse({ type: UnreadCountDto })
  unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<UnreadCountDto> {
    return this.notifications.unreadCount(user.id);
  }

  @Patch('notifications/read-all')
  @RateLimit('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all your unread notifications as read.' })
  @ApiNoContentResponse()
  markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.notifications.markAllRead(user.id);
  }

  @Patch('notifications/:id/read')
  @RateLimit('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark one notification as read. Errors: NOTIFICATION_NOT_FOUND (404).' })
  @ApiNoContentResponse()
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notifications.markRead(user.id, id);
  }

  @Patch('notifications/:id/archive')
  @RateLimit('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive one notification. Errors: NOTIFICATION_NOT_FOUND (404).' })
  @ApiNoContentResponse()
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notifications.archive(user.id, id);
  }

  @Delete('notifications/:id')
  @RateLimit('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete one notification (soft). Errors: NOTIFICATION_NOT_FOUND (404).',
  })
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notifications.remove(user.id, id);
  }

  @Get('notification-preferences')
  @RateLimit('read')
  @ApiOperation({ summary: 'Your notification category preferences (defaults all on).' })
  @ApiOkResponse({ type: NotificationPreferencesDto })
  getPreferences(@CurrentUser() user: AuthenticatedUser): Promise<NotificationPreferencesDto> {
    return this.notifications.getPreferences(user.id);
  }

  @Patch('notification-preferences')
  @RateLimit('write')
  @ApiOperation({ summary: 'Enable/disable notification categories (partial update).' })
  @ApiOkResponse({ type: NotificationPreferencesDto })
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesDto> {
    return this.notifications.updatePreferences(user.id, dto);
  }
}
