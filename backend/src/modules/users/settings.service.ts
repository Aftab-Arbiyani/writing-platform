import { Injectable } from '@nestjs/common';
import { ThemePreference, Visibility } from '@qalam/shared';

import type { UpdateSettingsDto } from './dto/update-settings.dto';
import type { SettingsResponseDto } from './dto/settings-response.dto';
import type { UserSettings } from './entities/user-settings.entity';
import { UserSettingsRepository } from './user-settings.repository';

/**
 * Per-user preference bag (theme, default piece visibility, notification
 * preferences). Account privacy and compose language live on the profile
 * (`PATCH /me`), not here. Settings rows are created lazily on first access.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly repository: UserSettingsRepository) {}

  async getOrCreate(userId: string): Promise<UserSettings> {
    const existing = await this.repository.findByUserId(userId);
    if (existing !== null) {
      return existing;
    }
    return this.repository.create({
      userId,
      theme: ThemePreference.System,
      defaultPieceVisibility: Visibility.Public,
      notificationPreferences: {},
      // B5: AI on by default — a user who has never opened settings has not opted out.
      aiEnabled: true,
    });
  }

  /**
   * B5 (docs/45 §4.10) — has this user turned AI off for their own account?
   *
   * **Read-only on purpose: it must not `getOrCreate`.** This runs on the AI gate
   * path (`AiFeatureService`), i.e. on every AI request and every `GET /ai/features`,
   * and a lazy INSERT there would turn a read into a write on the hot path — and
   * would write rows for users who never touched a setting. A missing row means
   * "never chose", which is `true`, the same answer the column default gives.
   */
  async isAiEnabledFor(userId: string): Promise<boolean> {
    const settings = await this.repository.findByUserId(userId);
    return settings?.aiEnabled ?? true;
  }

  async get(userId: string): Promise<SettingsResponseDto> {
    return toDto(await this.getOrCreate(userId));
  }

  async update(userId: string, dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    const current = await this.getOrCreate(userId);
    await this.repository.update(userId, {
      theme: dto.theme ?? current.theme,
      defaultPieceVisibility: dto.defaultPieceVisibility ?? current.defaultPieceVisibility,
      // Shallow-merge notification flags so a partial update doesn't wipe others.
      notificationPreferences:
        dto.notificationPreferences === undefined
          ? current.notificationPreferences
          : { ...current.notificationPreferences, ...dto.notificationPreferences },
      aiEnabled: dto.aiEnabled ?? current.aiEnabled,
    });
    return this.get(userId);
  }
}

function toDto(s: UserSettings): SettingsResponseDto {
  return {
    theme: s.theme,
    defaultPieceVisibility: s.defaultPieceVisibility,
    notificationPreferences: s.notificationPreferences,
    aiEnabled: s.aiEnabled,
  };
}
