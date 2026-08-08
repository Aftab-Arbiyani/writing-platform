import { ApiPropertyOptional } from '@nestjs/swagger';
import { ThemePreference, Visibility } from '@qalam/shared';
import { IsBoolean, IsEnum, IsObject, IsOptional } from 'class-validator';

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

  /**
   * B5 (docs/45 §4.10). Turning this off makes the server REFUSE this user's AI
   * requests (`AI_DISABLED_BY_USER`) and report every AI feature off on
   * `GET /ai/features` — it is not a client-side hide.
   *
   * Independent of the `ai_personalization` consent (`PUT /privacy/consent`),
   * which governs whether the user's work may be used to IMPROVE AI. This one
   * governs whether the tools are offered to them at all; either may be set
   * without the other.
   */
  @ApiPropertyOptional({
    description:
      'Turn AI off for your own account. Server-enforced: AI requests are refused and ' +
      'GET /ai/features reports everything off. Separate from the ai_personalization consent.',
  })
  @IsOptional()
  @IsBoolean()
  aiEnabled?: boolean;
}
