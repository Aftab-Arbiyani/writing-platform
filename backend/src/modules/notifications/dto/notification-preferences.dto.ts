import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * `PATCH /notification-preferences` body — partial update; every field optional.
 * Categories map to notification types (see `TYPE_PREFERENCE`). Get-or-create:
 * a first update materializes the row (all-true defaults) then applies the diff.
 */
export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'New follower / follow request / accepted.' })
  @IsOptional()
  @IsBoolean()
  follow?: boolean;

  @ApiPropertyOptional({ description: 'New comment on your piece.' })
  @IsOptional()
  @IsBoolean()
  comment?: boolean;

  @ApiPropertyOptional({ description: 'Reply to your comment.' })
  @IsOptional()
  @IsBoolean()
  reply?: boolean;

  @ApiPropertyOptional({ description: 'Likes and claps on your piece.' })
  @IsOptional()
  @IsBoolean()
  reaction?: boolean;

  @ApiPropertyOptional({ description: 'Mentions of you in a piece or comment.' })
  @IsOptional()
  @IsBoolean()
  mention?: boolean;

  @ApiPropertyOptional({ description: 'A response piece to your piece.' })
  @IsOptional()
  @IsBoolean()
  response?: boolean;

  @ApiPropertyOptional({ description: 'System / announcement notifications.' })
  @IsOptional()
  @IsBoolean()
  system?: boolean;
}

/** The full, resolved set of a user's notification preferences. */
export class NotificationPreferencesDto {
  @ApiProperty() follow!: boolean;
  @ApiProperty() comment!: boolean;
  @ApiProperty() reply!: boolean;
  @ApiProperty() reaction!: boolean;
  @ApiProperty() mention!: boolean;
  @ApiProperty() response!: boolean;
  @ApiProperty() system!: boolean;
}
