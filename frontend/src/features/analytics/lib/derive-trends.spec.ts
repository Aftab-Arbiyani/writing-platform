import { describe, expect, it } from 'vitest';

import { deriveTrend, metricSeries } from './derive-trends';
import type { GrowthPoint } from '../types/analytics.types';

const points = (values: number[]): GrowthPoint[] =>
  values.map((v, i) => ({ periodStart: `2026-07-0${String(i + 1)}`, metrics: { views: v } }));

describe('deriveTrend', () => {
  it('returns null with fewer than two points (never a fabricated delta)', () => {
    expect(deriveTrend([], 'views')).toBeNull();
    expect(deriveTrend(points([5]), 'views')).toBeNull();
  });

  it('computes an upward trend + percent over the window', () => {
    const t = deriveTrend(points([100, 150]), 'views');
    expect(t).not.toBeNull();
    expect(t?.direction).toBe('up');
    expect(t?.delta).toBe(50);
    expect(t?.deltaPct).toBeCloseTo(0.5);
  });

  it('computes a downward trend', () => {
    const t = deriveTrend(points([80, 60]), 'views');
    expect(t?.direction).toBe('down');
    expect(t?.delta).toBe(-20);
  });

  it('reports flat when unchanged', () => {
    expect(deriveTrend(points([10, 10]), 'views')?.direction).toBe('flat');
  });

  it('leaves deltaPct null when the starting value is 0', () => {
    const t = deriveTrend(points([0, 25]), 'views');
    expect(t?.delta).toBe(25);
    expect(t?.deltaPct).toBeNull();
  });

  it('returns null for a metric absent from the snapshots (no fabricated 0-trend)', () => {
    expect(deriveTrend(points([10, 20]), 'nope')).toBeNull();
  });
});

describe('metricSeries', () => {
  it('maps points to [date, value] pairs for the plotted metric', () => {
    expect(metricSeries(points([1, 2, 3]), 'views')).toEqual([
      ['2026-07-01', 1],
      ['2026-07-02', 2],
      ['2026-07-03', 3],
    ]);
  });
});
