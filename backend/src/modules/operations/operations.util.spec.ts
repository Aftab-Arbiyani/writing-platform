import type { OperationalSignals } from './operations.types';
import { clamp, readSignal, round2, round4 } from './operations.util';

const signals: OperationalSignals = {
  api: { p95Ms: 120, p99Ms: 300, errorRatePercent: 0.5, availability: 0.995, successRate: 0.995 },
  ai: { p95Ms: 8000, availability: 0.99 },
  search: { p95Ms: 210 },
  payments: { p95Ms: 900, successRate: 0.99 },
  cache: { hitRatio: 0.92 },
  db: { slowQueryCount: 2 },
  runtime: { eventLoopLagP95Ms: 12, heapUsedBytes: 500_000_000, cpuPercent: 40 },
  queue: { oldestWaitingSeconds: 5 },
  capacity: { shouldScaleCount: 1 },
  security: { eventRatePerMin: null },
  cost: { dailyUsd: 12.5 },
};

describe('operations.util', () => {
  it('rounds to 2 and 4 decimals', () => {
    expect(round2(1.2345)).toBe(1.23);
    expect(round4(1.234567)).toBe(1.2346);
  });

  it('clamps into range', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  describe('readSignal', () => {
    it('reads nested metrics by dot-path', () => {
      expect(readSignal(signals, 'api.p95Ms')).toBe(120);
      expect(readSignal(signals, 'cache.hitRatio')).toBe(0.92);
      expect(readSignal(signals, 'db.slowQueryCount')).toBe(2);
      expect(readSignal(signals, 'capacity.shouldScaleCount')).toBe(1);
      expect(readSignal(signals, 'cost.dailyUsd')).toBe(12.5);
    });

    it('returns null for an unmeasured signal', () => {
      expect(readSignal(signals, 'security.eventRatePerMin')).toBeNull();
    });

    it('returns null for an unknown metric', () => {
      expect(readSignal(signals, 'nope.nothing')).toBeNull();
    });
  });
});
