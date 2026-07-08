import { ApiPropertyOptional } from '@nestjs/swagger';
import { ThemePreference, Visibility } from '@qalam/shared';
import { IsEnum, IsObject, IsOptional } from 'class-validator';

/**
 * `PATCH /settings` body — the DB-only preference bag. Account privacy
 * (`isPrivate`) and compose language live on the profile (`PATCH /me`), not here.
 */
export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: Object.values(ThemePreference) })
  @IsOptional()
  @IsEnum(ThemePreference)
  theme?: ThemePreference;

  @ApiPropertyOptional({
    enum: Object.values(Visibility),
    description: 'Default visibility for future pieces.',
  })
  @IsOptional()
  @IsEnum(Visibility)
  defaultPieceVisibility?: Visibility;

  @ApiPropertyOptional({
    additionalProperties: { type: 'boolean' },
    description: 'Per-type on/off flags (sending is E9).',
    example: { newFollower: true, followRequest: true },
  })
  @IsOptional()
  @IsObject()
  notificationPreferences?: Record<string, boolean>;
}
