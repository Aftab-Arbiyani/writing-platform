import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationStatus, NotificationType } from '@qalam/shared';
import { IsEnum, IsOptional } from 'class-validator';

import { CursorPaginationDto } from '../../../common/dto/cursor-pagination.dto';

/**
 * `GET /notifications` — the recipient's inbox, newest first, cursor-paginated
 * (docs 05 §5.1). Omitting `status` returns the active inbox (unread + read,
 * excluding archived + soft-deleted). Filters only ever narrow.
 */
export class NotificationQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({
    enum: Object.values(NotificationStatus),
    description: 'Filter by state; omit for the active inbox (unread + read).',
  })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({
    enum: Object.values(NotificationType),
    description: 'Filter by notification type (e.g. `mention`).',
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}
