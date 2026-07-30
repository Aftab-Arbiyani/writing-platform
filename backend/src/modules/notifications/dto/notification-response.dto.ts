import { ApiProperty } from '@nestjs/swagger';
import type { NotificationStatus, NotificationType } from '@qalam/shared';

/** The actor who triggered a notification (denormalized at emit time). */
export class NotificationActorDto {
  @ApiProperty() username!: string;
  @ApiProperty({ nullable: true }) penName!: string | null;
  @ApiProperty({ nullable: true, description: 'S3 key; client builds the CDN URL.' })
  avatarKey!: string | null;
}

/**
 * One inbox item. `status` is derived (`read_at`/`archived_at`); `data` is the
 * denormalized, type-specific render payload so the client never re-fetches.
 */
export class NotificationDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'clap', description: 'NotificationType wire value.' })
  type!: NotificationType;
  @ApiProperty({ example: 'unread', description: 'unread | read | archived.' })
  status!: NotificationStatus;
  @ApiProperty({ type: NotificationActorDto, nullable: true })
  actor!: NotificationActorDto | null;
  @ApiProperty({ nullable: true, example: 'piece' }) entityType!: string | null;
  @ApiProperty({ nullable: true }) entityId!: string | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Denormalized render payload (piece title/slug, comment excerpt, …).',
  })
  data!: Record<string, unknown>;
  @ApiProperty({ nullable: true }) readAt!: string | null;
  @ApiProperty({ nullable: true }) archivedAt!: string | null;
  @ApiProperty() createdAt!: string;
}

/** `GET /notifications/unread-count` payload. */
export class UnreadCountDto {
  @ApiProperty({ description: 'Exact unread count.' }) count!: number;
  @ApiProperty({ description: 'True when count exceeds the badge display cap (99+).' })
  capped!: boolean;
}
