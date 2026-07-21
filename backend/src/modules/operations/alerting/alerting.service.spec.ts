import type { ConfigType } from '@nestjs/config';

import type { operationsConfig } from '../../../config/operations.config';
import type { RedisService } from '../../../redis/redis.service';
import type { SignalCollectorService } from '../collector/signal-collector.service';
import { ALERT_CATEGORY } from '../operations.constants';
import type { OperationalSignals } from '../operations.types';
import { AlertingService } from './alerting.service';

type OpsConfig = ConfigType<typeof operationsConfig>;

/** Minimal in-memory ioredis fake covering the ops usages. */
function fakeRedis() {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const hash = (k: string) => hashes.get(k) ?? hashes.set(k, new Map()).get(k)!;
  return {
    set: jest.fn((key: string, val: string, _ex: string, _ttl: number, nx?: string) => {
      if (nx === 'NX' && strings.has(key)) {
        return Promise.resolve(null);
      }
      strings.set(key, val);
      return Promise.resolve('OK');
    }),
    sadd: jest.fn(() => Promise.resolve(1)),
    hset: jest.fn((key: string, field: string, val: string) => {
      hash(key).set(field, val);
      return Promise.resolve(1);
    }),
    hdel: jest.fn((key: string, field: string) => {
      hash(key).delete(field);
      return Promise.resolve(1);
    }),
    hgetall: jest.fn((key: string) => Promise.resolve(Object.fromEntries(hash(key)))),
  };
}

function signals(overrides: Partial<OperationalSignals> = {}): OperationalSignals {
  return {
    api: { p95Ms: 120, p99Ms: 300, errorRatePercent: 0.2, availability: 0.999, successRate: 0.999 },
    ai: { p95Ms: 8000, availability: 0.995 },
    search: { p95Ms: 210 },
    payments: { p95Ms: 900, successRate: 0.995 },
    cache: { hitRatio: 0.92 },
    db: { slowQueryCount: 0 },
    runtime: { eventLoopLagP95Ms: 12, heapUsedBytes: 5e8, cpuPercent: 40 },
    queue: { oldestWaitingSeconds: 5 },
    capacity: { shouldScaleCount: 0 },
    security: { eventRatePerMin: null },
    cost: { dailyUsd: 12 },
    ...overrides,
  };
}

const config = {
  alerting: { dedupWindowSeconds: 300, retentionSeconds: 604_800 },
} as OpsConfig;

function make(sig: OperationalSignals, redis = fakeRedis()) {
  const redisService = { getClient: () => redis } as unknown as RedisService;
  const collector = {
    collect: jest.fn().mockResolvedValue(sig),
  } as unknown as SignalCollectorService;
  const service = new AlertingService(redisService, collector, config);
  return { service, redis };
}

describe('AlertingService', () => {
  it('fires the critical API error-rate alert on breaching signals', async () => {
    const { service } = make(signals({ api: { ...signals().api, errorRatePercent: 10 } }));
    const report = await service.evaluate();
    expect(report.firing).toBeGreaterThanOrEqual(1);
    expect(report.evaluations.find((e) => e.id === 'alert.api.error_rate.critical')?.firing).toBe(
      true,
    );
  });

  it('deduplicates a repeat firing within the window', async () => {
    const { service } = make(signals({ api: { ...signals().api, errorRatePercent: 10 } }));
    await service.evaluate();
    const second = await service.evaluate();
    const critical = second.evaluations.find((e) => e.id === 'alert.api.error_rate.critical');
    expect(critical?.suppressed).toBe(true);
    expect(critical?.suppressedReason).toBe('deduplicated');
  });

  it('suppresses alerts inside a maintenance window for the category', async () => {
    const { service } = make(signals({ api: { ...signals().api, errorRatePercent: 10 } }));
    await service.openMaintenanceWindow({
      reason: 'deploy',
      categories: [ALERT_CATEGORY.Availability],
      durationMinutes: 30,
    });
    const report = await service.evaluate();
    const critical = report.evaluations.find((e) => e.id === 'alert.api.error_rate.critical');
    expect(critical?.suppressed).toBe(true);
    expect(critical?.suppressedReason).toContain('maintenance');
  });

  it('escalates a firing critical alert to the incident opener', async () => {
    const { service } = make(signals({ api: { ...signals().api, errorRatePercent: 10 } }));
    const opener = { openFromAlert: jest.fn().mockResolvedValue(undefined) };
    service.registerIncidentOpener(opener);
    await service.evaluate();
    expect(opener.openFromAlert).toHaveBeenCalled();
  });

  it('does not fire under healthy signals', async () => {
    const { service } = make(signals());
    const report = await service.evaluate();
    expect(report.firing).toBe(0);
  });

  it('closes a maintenance window', async () => {
    const { service } = make(signals());
    const window = await service.openMaintenanceWindow({ reason: 'x', durationMinutes: 10 });
    await service.closeMaintenanceWindow(window.id);
    expect(await service.activeMaintenanceWindows()).toHaveLength(0);
  });
});
