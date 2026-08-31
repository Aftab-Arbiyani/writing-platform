import type { DataSource, EntityManager } from 'typeorm';

import type { AuditService } from '../audit/audit.service';
import { SETTINGS_AUDIT_ACTIONS, SETTINGS_CACHE_KEYS } from './settings.constants';
import type { SettingsCacheService } from './settings-cache.service';
import type { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';
import type { SettingsActor } from './settings.util';
import type { FeatureFlag } from './entities/feature-flag.entity';
import type { Setting } from './entities/setting.entity';

const ACTOR: SettingsActor = {
  id: 'admin-1',
  role: 'admin',
  ip: '127.0.0.1',
  userAgent: 'jest',
  requestId: 'req-1',
};

function settingRow(overrides: Partial<Setting> = {}): Setting {
  return {
    id: 'set-1',
    key: 'auth.registration.enabled',
    category: 'registration',
    value: true,
    dataType: 'boolean',
    defaultValue: true,
    validationRules: {},
    description: 'Allow new account sign-ups.',
    editable: true,
    environmentScope: 'all',
    updatedBy: null,
    createdAt: new Date('2026-07-10T00:00:00.000Z'),
    updatedAt: new Date('2026-07-10T00:00:00.000Z'),
    ...overrides,
  } as Setting;
}

function flagRow(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return {
    id: '11111111-1111-7111-8111-111111111111',
    key: 'feature.ai.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI writing assistance.',
    updatedBy: null,
    createdAt: new Date('2026-07-10T00:00:00.000Z'),
    updatedAt: new Date('2026-07-10T00:00:00.000Z'),
    ...overrides,
  } as FeatureFlag;
}

function makeService(repo: Partial<SettingsRepository> = {}, cacheHit?: unknown) {
  const repoMock = {
    findAll: jest.fn().mockResolvedValue([]),
    findByCategory: jest.fn().mockResolvedValue([]),
    findByKeys: jest.fn((keys: string[]) =>
      Promise.resolve(keys.map((key) => settingRow({ key }))),
    ),
    findByKey: jest.fn(),
    setValue: jest.fn().mockResolvedValue(undefined),
    syncDefinitions: jest.fn().mockResolvedValue(undefined),
    findAllFlags: jest.fn().mockResolvedValue([]),
    findFlagById: jest.fn(),
    findFlagByKey: jest.fn().mockResolvedValue(null),
    createFlag: jest.fn(),
    updateFlag: jest.fn().mockResolvedValue(undefined),
    deleteFlag: jest.fn().mockResolvedValue(undefined),
    syncFlagDefinitions: jest.fn().mockResolvedValue(undefined),
    ...repo,
  } as unknown as jest.Mocked<SettingsRepository>;

  const cache = {
    // remember returns the cached value if provided, else runs the compute path.
    remember: jest.fn((_key: string, _ttl: number, compute: () => Promise<unknown>) =>
      cacheHit === undefined ? compute() : Promise.resolve(cacheHit),
    ),
    invalidate: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    set: jest.fn(),
  } as unknown as jest.Mocked<SettingsCacheService>;

  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  // Fake DataSource whose transaction just invokes the callback with a stub manager.
  const dataSource = {
    transaction: jest.fn((cb: (m: EntityManager) => Promise<unknown>) => cb({} as EntityManager)),
  } as unknown as DataSource;

  const service = new SettingsService(dataSource, repoMock, cache, audit);
  return { service, repo: repoMock, cache, audit, dataSource };
}

describe('SettingsService — reads & cache', () => {
  it('getAllSettings reads through the cache and maps rows to DTOs', async () => {
    const { service, repo, cache } = makeService({
      findAll: jest.fn().mockResolvedValue([
        settingRow(),
        settingRow({
          key: 'platform.name',
          dataType: 'string',
          value: 'Qalam',
          category: 'general',
        }),
      ]),
    });
    const result = await service.getAllSettings();
    expect(cache.remember).toHaveBeenCalledWith(
      SETTINGS_CACHE_KEYS.All,
      expect.any(Number),
      expect.any(Function),
    );
    expect(repo.findAll).toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0]?.key).toBe('auth.registration.enabled');
  });

  it('getAllSettings serves the cached value without hitting the repo', async () => {
    const cached = [{ key: 'platform.name', value: 'Qalam' }];
    const { service, repo } = makeService({}, cached);
    const result = await service.getAllSettings();
    expect(result).toBe(cached);
    expect(repo.findAll).not.toHaveBeenCalled();
  });

  it('getSettingsByCategory filters the full cached set', async () => {
    const cached = [
      { key: 'platform.name', category: 'general' },
      { key: 'auth.registration.enabled', category: 'registration' },
    ];
    const { service } = makeService({}, cached);
    const result = await service.getSettingsByCategory('general');
    expect(result).toEqual([{ key: 'platform.name', category: 'general' }]);
  });

  it('never assigns updatedAt while a setting is still at its default (updatedBy null)', async () => {
    const { service } = makeService({ findAll: jest.fn().mockResolvedValue([settingRow()]) });
    const [dto] = await service.getAllSettings();
    expect(dto?.updatedBy).toBeNull();
    expect(dto?.updatedAt).toBeNull();
  });
});

describe('SettingsService — validation', () => {
  it('rejects an unknown setting key with SETTING_NOT_FOUND (404)', async () => {
    const { service } = makeService();
    await expect(
      service.updateSettings([{ key: 'does.not.exist', value: 1 }], ACTOR),
    ).rejects.toMatchObject({ code: 'SETTING_NOT_FOUND', status: 404 });
  });

  it('rejects an update to a non-editable setting with SETTING_NOT_EDITABLE (403)', async () => {
    const { service } = makeService();
    // storage.provider is editable: false in the catalogue.
    await expect(
      service.updateSettings([{ key: 'storage.provider', value: 's3' }], ACTOR),
    ).rejects.toMatchObject({ code: 'SETTING_NOT_EDITABLE', status: 403 });
  });

  it('rejects a value that violates its data type with SETTING_INVALID_VALUE (422)', async () => {
    const { service, repo } = makeService();
    await expect(
      service.updateSettings([{ key: 'content.maxTags', value: 999 }], ACTOR),
    ).rejects.toMatchObject({ code: 'SETTING_INVALID_VALUE', status: 422 });
    // No write happened — validation runs before the transaction.
    expect(repo.setValue).not.toHaveBeenCalled();
  });

  it('rejects a key that is outside the requested category', async () => {
    const { service } = makeService();
    await expect(
      service.updateSettingsByCategory('security', [{ key: 'platform.name', value: 'X' }], ACTOR),
    ).rejects.toMatchObject({ code: 'SETTING_NOT_FOUND' });
  });
});

describe('SettingsService — writes, cache invalidation & audit', () => {
  it('writes each valid value, invalidates the cache, and audits per key', async () => {
    const { service, repo, cache, audit } = makeService();
    await service.updateSettings(
      [
        { key: 'auth.registration.enabled', value: false },
        { key: 'content.maxTags', value: 3 },
      ],
      ACTOR,
      'tightening sign-ups',
    );

    expect(repo.setValue).toHaveBeenCalledWith(
      'auth.registration.enabled',
      false,
      'admin-1',
      expect.anything(),
    );
    expect(repo.setValue).toHaveBeenCalledWith('content.maxTags', 3, 'admin-1', expect.anything());
    expect(cache.invalidate).toHaveBeenCalledWith(
      SETTINGS_CACHE_KEYS.All,
      SETTINGS_CACHE_KEYS.Maintenance,
    );
    expect(audit.record).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: SETTINGS_AUDIT_ACTIONS.SettingUpdate,
        actorId: 'admin-1',
        metadata: expect.objectContaining({
          key: 'content.maxTags',
          after: 3,
          reason: 'tightening sign-ups',
        }),
      }),
    );
  });
});

describe('SettingsService — feature flags', () => {
  it('lists flags through the cache', async () => {
    const { service, repo, cache } = makeService({
      findAllFlags: jest.fn().mockResolvedValue([flagRow()]),
    });
    const result = await service.getFeatureFlags();
    expect(cache.remember).toHaveBeenCalledWith(
      SETTINGS_CACHE_KEYS.Flags,
      expect.any(Number),
      expect.any(Function),
    );
    expect(result[0]?.key).toBe('feature.ai.enabled');
    expect(repo.findAllFlags).toHaveBeenCalled();
  });

  it('creates a flag, invalidates the flag cache, and audits', async () => {
    const created = flagRow({ enabled: true });
    const { service, repo, cache, audit } = makeService({
      findFlagByKey: jest.fn().mockResolvedValue(null),
      createFlag: jest.fn().mockResolvedValue(created),
    });
    const result = await service.createFeatureFlag(
      { key: 'feature.ai.enabled', enabled: true },
      ACTOR,
    );
    expect(repo.createFlag).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'feature.ai.enabled', enabled: true, updatedBy: 'admin-1' }),
    );
    expect(cache.invalidate).toHaveBeenCalledWith(SETTINGS_CACHE_KEYS.Flags);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: SETTINGS_AUDIT_ACTIONS.FeatureFlagCreate }),
    );
    expect(result.enabled).toBe(true);
  });

  it('rejects creating a flag whose key already exists (409)', async () => {
    const { service } = makeService({ findFlagByKey: jest.fn().mockResolvedValue(flagRow()) });
    await expect(
      service.createFeatureFlag({ key: 'feature.ai.enabled' }, ACTOR),
    ).rejects.toMatchObject({ code: 'FEATURE_FLAG_ALREADY_EXISTS', status: 409 });
  });

  it('throws FEATURE_FLAG_NOT_FOUND (404) when updating a missing flag', async () => {
    const { service } = makeService({ findFlagById: jest.fn().mockResolvedValue(null) });
    await expect(
      service.updateFeatureFlag('11111111-1111-7111-8111-111111111111', { enabled: true }, ACTOR),
    ).rejects.toMatchObject({ code: 'FEATURE_FLAG_NOT_FOUND', status: 404 });
  });

  it('deletes a flag, invalidates the cache, and audits', async () => {
    const { service, repo, cache, audit } = makeService({
      findFlagById: jest.fn().mockResolvedValue(flagRow()),
    });
    await service.deleteFeatureFlag('11111111-1111-7111-8111-111111111111', ACTOR);
    expect(repo.deleteFlag).toHaveBeenCalledWith('11111111-1111-7111-8111-111111111111');
    expect(cache.invalidate).toHaveBeenCalledWith(SETTINGS_CACHE_KEYS.Flags);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: SETTINGS_AUDIT_ACTIONS.FeatureFlagDelete }),
    );
  });
});

describe('SettingsService — maintenance mode', () => {
  const maintenanceRows = [
    settingRow({
      key: 'maintenance.enabled',
      category: 'maintenance',
      dataType: 'boolean',
      value: true,
    }),
    settingRow({
      key: 'maintenance.message',
      category: 'maintenance',
      dataType: 'string',
      value: 'Back soon',
    }),
    settingRow({
      key: 'maintenance.estimatedCompletion',
      category: 'maintenance',
      dataType: 'string',
      value: '',
    }),
    settingRow({
      key: 'maintenance.allowedRoles',
      category: 'maintenance',
      dataType: 'array',
      value: ['admin'],
    }),
  ];

  it('derives the maintenance view from the settings store', async () => {
    const { service } = makeService({ findAll: jest.fn().mockResolvedValue(maintenanceRows) });
    const view = await service.getMaintenance();
    expect(view).toEqual({
      enabled: true,
      message: 'Back soon',
      estimatedCompletion: null,
      allowedRoles: ['admin'],
    });
  });

  it('updates only provided fields and records one maintenance.update audit', async () => {
    const { service, repo, cache, audit } = makeService({
      findAll: jest.fn().mockResolvedValue(maintenanceRows),
    });
    await service.updateMaintenance({ enabled: false, message: 'All clear' }, ACTOR);
    expect(repo.setValue).toHaveBeenCalledWith(
      'maintenance.enabled',
      false,
      'admin-1',
      expect.anything(),
    );
    expect(repo.setValue).toHaveBeenCalledWith(
      'maintenance.message',
      'All clear',
      'admin-1',
      expect.anything(),
    );
    expect(repo.setValue).not.toHaveBeenCalledWith(
      'maintenance.allowedRoles',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(cache.invalidate).toHaveBeenCalledWith(
      SETTINGS_CACHE_KEYS.All,
      SETTINGS_CACHE_KEYS.Maintenance,
    );
    const maintenanceAudits = audit.record.mock.calls.filter(
      ([arg]) => arg.action === SETTINGS_AUDIT_ACTIONS.MaintenanceUpdate,
    );
    expect(maintenanceAudits).toHaveLength(1);
  });
});

describe('SettingsService — boot sync', () => {
  it('seeds the setting and flag catalogues on module init', async () => {
    const { service, repo } = makeService();
    await service.onModuleInit();
    expect(repo.syncDefinitions).toHaveBeenCalled();
    expect(repo.syncFlagDefinitions).toHaveBeenCalled();
  });

  /**
   * Regression: `web-e2e.yml` run #23 (2026-08-31) failed step 10 in ALL SEVEN jobs, before a
   * single test ran, with `Unknown setting: monetization.plans`.
   *
   * The caches are in Redis, so a read that happens BEFORE this sync outlives its process. Nest
   * orders no module's init against another's, and `MonetizationConfigService` reads
   * `monetization.plans` during its own — on a stack with empty Redis AND empty Postgres it lost
   * that race, cached `settings:all = []`, and every later PROCESS inherited it: `pnpm seed`
   * warmed the poison, `pnpm seed:e2e` read it and threw.
   *
   * So the invalidation is load-bearing, not hygiene, and it must happen AFTER both syncs —
   * invalidating first would just re-open the window. Asserted by call order rather than by
   * presence alone, because "it invalidates somewhere" is the version of this that still breaks.
   */
  it('invalidates the caches AFTER syncing, so nothing cached pre-sync survives', async () => {
    const { service, repo, cache } = makeService();
    const order: string[] = [];
    (repo.syncDefinitions as jest.Mock).mockImplementation(() => {
      order.push('syncDefinitions');
      return Promise.resolve();
    });
    (repo.syncFlagDefinitions as jest.Mock).mockImplementation(() => {
      order.push('syncFlagDefinitions');
      return Promise.resolve();
    });
    (cache.invalidate as jest.Mock).mockImplementation(() => {
      order.push('invalidate');
      return Promise.resolve();
    });

    await service.onModuleInit();

    expect(order).toEqual(['syncDefinitions', 'syncFlagDefinitions', 'invalidate']);
    expect(cache.invalidate).toHaveBeenCalledWith(
      SETTINGS_CACHE_KEYS.All,
      SETTINGS_CACHE_KEYS.Flags,
      SETTINGS_CACHE_KEYS.Maintenance,
    );
  });
});
