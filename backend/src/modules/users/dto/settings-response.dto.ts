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

  /**
   * B5 (docs/45 §4.10) — the caller's own "AI is on for me" switch. `true` by
   * default. Distinct from the `ai_personalization` consent (`GET /privacy/consent`):
   * this is "offer me the tools", that is "train on my work".
   */
  @ApiProperty({ description: 'Whether the caller has AI turned on for their own account.' })
  aiEnabled!: boolean;
}
