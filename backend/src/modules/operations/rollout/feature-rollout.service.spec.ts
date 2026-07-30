import type { FeatureFlagDto } from '../../settings/dto/feature-flag.dto';
import type { SettingsService } from '../../settings/settings.service';
import type { SettingsActor } from '../../settings/settings.util';
import { OperationsException } from '../operations.exceptions';
import { FeatureRolloutService } from './feature-rollout.service';

const actor: SettingsActor = {
  id: 'u1',
  role: 'admin',
  ip: null,
  userAgent: null,
  requestId: null,
};

function flag(overrides: Partial<FeatureFlagDto> = {}): FeatureFlagDto {
  return {
    id: 'f1',
    key: 'feature.ai.enabled',
    enabled: true,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI',
    updatedBy: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function makeSettings(flags: FeatureFlagDto[]): SettingsService {
  return {
    getFeatureFlags: jest.fn().mockResolvedValue(flags),
    updateFeatureFlag: jest
      .fn()
      .mockImplementation((_id: string, dto: Partial<FeatureFlagDto>) =>
        Promise.resolve(flag({ ...flags[0], ...dto })),
      ),
  } as unknown as SettingsService;
}

describe('FeatureRolloutService', () => {
  it('projects rollout strategy from the flag state', async () => {
    const service = new FeatureRolloutService(
      makeSettings([
        flag({ key: 'a.full', enabled: true, rolloutPercentage: 100 }),
        flag({ key: 'a.canary', enabled: true, rolloutPercentage: 10 }),
        flag({ key: 'a.pct', enabled: true, rolloutPercentage: 60 }),
        flag({ key: 'a.off', enabled: false }),
        flag({ key: 'a.env', enabled: true, environment: 'production' }),
      ]),
    );
    const states = await service.list();
    const by = (k: string) => states.find((s) => s.key === k);
    expect(by('a.full')?.strategy).toBe('full');
    expect(by('a.canary')?.strategy).toBe('canary');
    expect(by('a.pct')?.strategy).toBe('percentage');
    expect(by('a.off')?.strategy).toBe('off');
    expect(by('a.off')?.killSwitchEngaged).toBe(true);
    expect(by('a.env')?.strategy).toBe('environment');
  });

  it('sets a rollout percentage through SettingsService', async () => {
    const settings = makeSettings([flag()]);
    const service = new FeatureRolloutService(settings);
    await service.setPercentage('feature.ai.enabled', 25, actor);
    expect(settings.updateFeatureFlag).toHaveBeenCalledWith(
      'f1',
      { enabled: true, rolloutPercentage: 25 },
      actor,
    );
  });

  it('rejects an out-of-range percentage', async () => {
    const service = new FeatureRolloutService(makeSettings([flag()]));
    await expect(service.setPercentage('feature.ai.enabled', 150, actor)).rejects.toBeInstanceOf(
      OperationsException,
    );
  });

  it('kill switch disables the flag', async () => {
    const settings = makeSettings([flag()]);
    const service = new FeatureRolloutService(settings);
    await service.killSwitch('feature.ai.enabled', actor);
    expect(settings.updateFeatureFlag).toHaveBeenCalledWith('f1', { enabled: false }, actor);
  });

  it('throws when the rollout key has no backing flag', async () => {
    const service = new FeatureRolloutService(makeSettings([flag()]));
    await expect(service.get('feature.missing')).rejects.toBeInstanceOf(OperationsException);
  });

  it('evaluates a rollout for a subject deterministically', async () => {
    const service = new FeatureRolloutService(
      makeSettings([flag({ enabled: true, rolloutPercentage: 100 })]),
    );
    expect(await service.evaluate('feature.ai.enabled', 'user-1')).toBe(true);
  });
});
