import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SYSTEM_NOTIFICATION_BODY_MAX, SYSTEM_NOTIFICATION_TITLE_MAX } from '@qalam/shared';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** `POST /admin/system-notifications` body (admin only) — create + broadcast. */
export class CreateSystemNotificationDto {
  @ApiProperty({ maxLength: SYSTEM_NOTIFICATION_TITLE_MAX, example: 'Scheduled maintenance' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(SYSTEM_NOTIFICATION_TITLE_MAX)
  title!: string;

  @ApiProperty({ maxLength: SYSTEM_NOTIFICATION_BODY_MAX })
  @IsString()
  @IsNotEmpty()
  @MaxLength(SYSTEM_NOTIFICATION_BODY_MAX)
  body!: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Optional extra render payload merged into each delivered notification.',
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

/** An admin broadcast record (with how many recipients it reached). */
export class SystemNotificationDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) data!: Record<string, unknown>;
  @ApiProperty({ nullable: true }) createdBy!: string | null;
  @ApiProperty({ example: 'all' }) audience!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ description: 'Number of recipients the broadcast was delivered to.' })
  deliveredCount!: number;
}
