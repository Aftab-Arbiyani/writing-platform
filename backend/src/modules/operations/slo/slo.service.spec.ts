import type { ConfigType } from '@nestjs/config';

import type { operationsConfig } from '../../../config/operations.config';
import type { SignalCollectorService } from '../collector/signal-collector.service';
import type { OperationalSignals } from '../operations.types';
import { SloService } from './slo.service';

type OpsConfig = ConfigType<typeof operationsConfig>;

function signals(overrides: Partial<OperationalSignals> = {}): OperationalSignals {
  return {
    api: {
      p95Ms: 120,
      p99Ms: 300,
      errorRatePercent: 0.2,
      availability: 0.9995,
      successRate: 0.9995,
    },
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
  slo: { windowSeconds: 2_592_000, fastBurnThreshold: 14.4, slowBurnThreshold: 3 },
} as OpsConfig;

describe('SloService', () => {
  it('marks all objectives meeting under healthy signals', () => {
    const service = new SloService({} as SignalCollectorService, config);
    const report = service.evaluate(signals());
    expect(report.objectives.length).toBeGreaterThan(0);
    expect(report.breaching).toBe(0);
    expect(report.meeting).toBeGreaterThan(0);
  });

  it('breaches the API availability objective when availability drops', () => {
    const service = new SloService({} as SignalCollectorService, config);
    const report = service.evaluate(signals({ api: { ...signals().api, availability: 0.95 } }));
    const availability = report.objectives.find((o) => o.id === 'slo.api.availability');
    expect(availability?.status).toBe('breaching');
    expect(report.breaching).toBeGreaterThanOrEqual(1);
  });

  it('reports no_data objectives when a signal is missing', () => {
    const service = new SloService({} as SignalCollectorService, config);
    const report = service.evaluate(signals({ payments: { p95Ms: null, successRate: null } }));
    const payments = report.objectives.find((o) => o.id === 'slo.payments.success_rate');
    expect(payments?.status).toBe('no_data');
  });

  it('collects signals via the collector in report()', async () => {
    const collector = { collect: jest.fn().mockResolvedValue(signals()) };
    const service = new SloService(collector as unknown as SignalCollectorService, config);
    const report = await service.report();
    expect(collector.collect).toHaveBeenCalled();
    expect(report.windowSeconds).toBe(config.slo.windowSeconds);
  });

  it('flags fast-burning objectives above the configured threshold', () => {
    const service = new SloService({} as SignalCollectorService, config);
    const report = service.evaluate(signals({ api: { ...signals().api, availability: 0.9 } }));
    const fast = service.fastBurning(report.objectives);
    expect(fast.length).toBeGreaterThanOrEqual(1);
  });
});
