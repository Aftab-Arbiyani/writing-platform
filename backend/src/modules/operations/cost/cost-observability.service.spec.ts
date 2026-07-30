import type { ConfigType } from '@nestjs/config';

import type { CacheService } from '../../../infrastructure/cache/cache.service';
import type { operationsConfig } from '../../../config/operations.config';
import type { PerformancePlatformService } from '../../performance/performance-platform.service';
import { CostObservabilityService } from './cost-observability.service';

type OpsConfig = ConfigType<typeof operationsConfig>;

const config = {
  enabled: true,
  cost: {
    aiPerMillionTokensUsd: 6,
    storagePerGibMonthUsd: 0.023,
    bandwidthPerGibUsd: 0.09,
    infraMonthlyBaselineUsd: 120,
  },
} as OpsConfig;

function make(cachePrev: number | null = null) {
  const performance = {
    capacity: {
      plan: () =>
        Promise.resolve({
          generatedAt: '',
          scalingRecommendations: [],
          forecasts: [
            { resource: 'ai.tokens_daily', used: 1_000_000 } as never,
            { resource: 'storage.objects', used: 1_073_741_824 * 10 } as never,
          ],
        }),
    },
  } as unknown as PerformancePlatformService;
  const cache = {
    get: jest.fn().mockResolvedValue(cachePrev),
    set: jest.fn().mockResolvedValue(undefined),
  } as unknown as CacheService;
  return { service: new CostObservabilityService(performance, cache, config), cache };
}

describe('CostObservabilityService', () => {
  it('estimates cost by category from the capacity plan + rates', async () => {
    const { service } = make();
    const report = await service.estimate();
    const ai = report.lines.find((l) => l.category === 'ai');
    expect(ai?.dailyUsd).toBeCloseTo(6, 2); // 1M tokens × $6/Mtok
    const infra = report.lines.find((l) => l.category === 'infrastructure');
    expect(infra?.monthlyUsd).toBe(120);
    expect(report.dailyUsd).toBeGreaterThan(0);
  });

  it('reports trend "unknown" on the first estimate', async () => {
    const { service } = make(null);
    expect((await service.estimate()).trend).toBe('unknown');
  });

  it('reports a rising trend when cost climbs > 10%', async () => {
    const { service } = make(1); // previous daily was $1 → now much higher
    expect((await service.estimate()).trend).toBe('rising');
  });

  it('exposes the headline daily cost for the alert', async () => {
    const { service } = make();
    expect(await service.dailyUsd()).toBeGreaterThan(0);
  });

  it('lists every tracked category (transparency)', async () => {
    const { service } = make();
    const categories = (await service.estimate()).lines.map((l) => l.category);
    expect(categories).toEqual(
      expect.arrayContaining([
        'ai',
        'storage',
        'infrastructure',
        'bandwidth',
        'database',
        'redis',
        'queue',
        'api',
        'third_party',
      ]),
    );
  });
});
