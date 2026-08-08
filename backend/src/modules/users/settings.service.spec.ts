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
      aiEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // findByUserId is called twice (update → getOrCreate, then get → getOrCreate).
    const { service, repo } = build(existing);
    repo.findByUserId.mockResolvedValueOnce(existing as UserSettings).mockResolvedValueOnce({
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

  /**
   * B5 (docs/45 §4.10) — the per-account "turn AI off" switch.
   *
   * `isAiEnabledFor` is what the AI gate calls on every AI request, so its default
   * and its read-only-ness are both load-bearing.
   */
  describe('the AI switch (B5)', () => {
    it('defaults to ON for a user who has no settings row', async () => {
      const { service, repo } = build(null);

      await expect(service.isAiEnabledFor('u1')).resolves.toBe(true);
      // Read-only: this runs on the AI hot path and must not lazily INSERT a row.
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('defaults to ON in the created row, so a new user is unaffected', async () => {
      const { service, repo } = build(null);

      await service.get('u1');

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ aiEnabled: true }));
    });

    it('reports the stored choice once the user has opted out', async () => {
      const { service } = build({ aiEnabled: false });

      await expect(service.isAiEnabledFor('u1')).resolves.toBe(false);
    });

    it('is settable in both directions and left alone when absent from the patch', async () => {
      const existing = {
        userId: 'u1',
        theme: ThemePreference.System,
        defaultPieceVisibility: Visibility.Public,
        notificationPreferences: {},
        aiEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserSettings;

      const off = build(existing);
      await off.service.update('u1', { aiEnabled: false });
      expect(off.repo.update).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ aiEnabled: false }),
      );

      const back = build({ ...existing, aiEnabled: false } as UserSettings);
      await back.service.update('u1', { aiEnabled: true });
      expect(back.repo.update).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ aiEnabled: true }),
      );

      // A patch that does not mention it must not silently flip it — a theme change
      // must never turn a writer's AI back on.
      const untouched = build({ ...existing, aiEnabled: false } as UserSettings);
      await untouched.service.update('u1', { theme: ThemePreference.Dark });
      expect(untouched.repo.update).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ aiEnabled: false }),
      );
    });

    it('is independent of the ai_personalization consent — this service never touches it', async () => {
      /**
       * The two are deliberately separate choices (§4.10): "don't offer me the tools"
       * (here, `user_settings.ai_enabled`) versus "don't train on my work"
       * (`CONSENT_PURPOSE.AiPersonalization`, in the privacy module behind
       * `PUT /privacy/consent`). They live in different modules with different stores,
       * so setting one cannot move the other — which is what this asserts: the whole
       * update path writes only the preference-bag columns.
       */
      const { service, repo } = build({ aiEnabled: true });

      await service.update('u1', { aiEnabled: false });

      const patch = repo.update.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(Object.keys(patch).sort()).toEqual([
        'aiEnabled',
        'defaultPieceVisibility',
        'notificationPreferences',
        'theme',
      ]);
    });
  });
});
