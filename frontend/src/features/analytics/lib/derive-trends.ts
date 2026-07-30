import type { GrowthPoint } from '../types/analytics.types';

/**
 * A metric's movement across the selected growth window. Snapshot points carry the CUMULATIVE
 * aggregate at each time, so the change over the window = last − first (docs/06 §3.10 deltas). We
 * only ever compute a trend when there are ≥2 real snapshot points — otherwise `null` (no delta is
 * shown, never a fabricated one). `deltaPct` is null when the starting value was 0 (can't divide).
 */
export interface Trend {
  current: number;
  previous: number;
  delta: number;
  deltaPct: number | null;
  direction: 'up' | 'down' | 'flat';
}

export function deriveTrend(points: GrowthPoint[], metric: string): Trend | null {
  if (points.length < 2) return null;
  const first = points[0]?.metrics[metric] ?? 0;
  const last = points[points.length - 1]?.metrics[metric] ?? 0;
  // The metric isn't present in these snapshots → no honest trend to show.
  if (first === 0 && last === 0) return null;
  const delta = last - first;
  const direction: Trend['direction'] = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const deltaPct = first > 0 ? delta / first : null;
  return { current: last, previous: first, delta, deltaPct, direction };
}

/** The `[periodStart, value]` pairs for a metric — the series a growth chart plots. */
export function metricSeries(points: GrowthPoint[], metric: string): [string, number][] {
  return points.map((p) => [p.periodStart, p.metrics[metric] ?? 0]);
}
