import { ThemePreference, Visibility } from '@qalam/shared';

import type { UserSettings } from './entities/user-settings.entity';
import type { UserSettingsRepository } from './user-settings.repository';
import { SettingsService } from './settings.service';

function build(existing: Partial<UserSettings> | null): {
  service: SettingsService;
  repo: jest.Mocked<Pick<UserSettingsRepository, 'findByUserId' | 'create' | 'update'>>;
} {
  const repo = {
    findByUserId: jest.fn().mockResolvedValue(existing),
    create: jest.fn().mockImplementation((d: Partial<UserSettings>) => Promise.resolve(d)),
    update: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<Pick<UserSettingsRepository, 'findByUserId' | 'create' | 'update'>>;
  return { service: new SettingsService(repo as unknown as UserSettingsRepository), repo };
}

describe('SettingsService', () => {
  it('creates default settings on first access', async () => {
    const { service, repo } = build(null);
    const dto = await service.get('u1');
    expect(repo.create).toHaveBeenCalled();
    expect(dto.theme).toBe(ThemePreference.System);
    expect(dto.defaultPieceVisibility).toBe(Visibility.Public);
  });

  it('shallow-merges notification preferences on update (no wipe)', async () => {
    const existing = {
      userId: 'u1',
      theme: ThemePreference.System,
      defaultPieceVisibility: Visibility.Public,
      notificationPreferences: { newFollower: true },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // findByUserId is called twice (update → getOrCreate, then get → getOrCreate).
    const { service, repo } = build(existing);
    repo.findByUserId
      .mockResolvedValueOnce(existing as UserSettings)
      .mockResolvedValueOnce({
        ...existing,
        theme: ThemePreference.Dark,
        notificationPreferences: { newFollower: true, followRequest: false },
      } as UserSettings);

    const dto = await service.update('u1', {
      theme: ThemePreference.Dark,
      notificationPreferences: { followRequest: false },
    });

    expect(repo.update).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        theme: ThemePreference.Dark,
        notificationPreferences: { newFollower: true, followRequest: false },
      }),
    );
    expect(dto.theme).toBe(ThemePreference.Dark);
  });
});
