import { AnalyticsPeriod } from '@qalam/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { GrowthWindow } from '../types/analytics.types';

/**
 * Analytics CLIENT/UI state (docs/12 §3) — the ONLY analytics state in Zustand. All numbers are
 * SERVER state and live in TanStack Query (hard-rule #4). What belongs here is the reader's view
 * PREFERENCES (the prompt: "selected date range · dashboard · chart preferences"), persisted so the
 * dashboard reopens the way they left it:
 *
 *  - the growth "date range" (a preset resolved to the API's `period` + `points`; the writer
 *    aggregate is all-time and un-filterable, so the range only scopes the growth series),
 *  - which growth metric to plot, and
 *  - the growth chart style (area vs line).
 */

export type RangePreset = '7d' | '30d' | '90d' | '12w' | '12m';

/** Each range preset → the `GET /analytics/me/growth` window it requests. */
export const RANGE_WINDOWS: Record<RangePreset, GrowthWindow & { label: string }> = {
  '7d': { period: AnalyticsPeriod.Daily, points: 7, label: 'Last 7 days' },
  '30d': { period: AnalyticsPeriod.Daily, points: 30, label: 'Last 30 days' },
  '90d': { period: AnalyticsPeriod.Daily, points: 90, label: 'Last 90 days' },
  '12w': { period: AnalyticsPeriod.Weekly, points: 12, label: 'Last 12 weeks' },
  '12m': { period: AnalyticsPeriod.Monthly, points: 12, label: 'Last 12 months' },
};

/** Growth metric keys the snapshot series carries (backend `upsertSnapshot` writer block). */
export const GROWTH_METRICS = [
  { key: 'views', label: 'Views' },
  { key: 'uniqueViews', label: 'Unique views' },
  { key: 'reads', label: 'Reads' },
  { key: 'completedReads', label: 'Completed reads' },
  { key: 'followersGained', label: 'Followers gained' },
  { key: 'piecesPublished', label: 'Pieces published' },
] as const;

export type GrowthMetricKey = (typeof GROWTH_METRICS)[number]['key'];
export type ChartStyle = 'area' | 'line';

interface AnalyticsState {
  range: RangePreset;
  metric: GrowthMetricKey;
  chartStyle: ChartStyle;
  setRange: (range: RangePreset) => void;
  setMetric: (metric: GrowthMetricKey) => void;
  setChartStyle: (style: ChartStyle) => void;
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set) => ({
      range: '30d',
      metric: 'views',
      chartStyle: 'area',
      setRange: (range) => {
        set({ range });
      },
      setMetric: (metric) => {
        set({ metric });
      },
      setChartStyle: (chartStyle) => {
        set({ chartStyle });
      },
    }),
    { name: 'qalam-analytics' },
  ),
);

/** Resolve the active range preset to the API growth window. */
export function windowFor(range: RangePreset): GrowthWindow {
  const { period, points } = RANGE_WINDOWS[range];
  return { period, points };
}
