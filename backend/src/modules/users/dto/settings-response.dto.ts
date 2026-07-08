import { ApiProperty } from '@nestjs/swagger';
import { ThemePreference, Visibility } from '@qalam/shared';

/** `GET/PATCH /settings` response — the DB-only preference bag. */
export class SettingsResponseDto {
  @ApiProperty({ enum: Object.values(ThemePreference) })
  theme!: ThemePreference;

  @ApiProperty({ enum: Object.values(Visibility) })
  defaultPieceVisibility!: Visibility;

  @ApiProperty({ additionalProperties: { type: 'boolean' } })
  notificationPreferences!: Record<string, boolean>;
}
