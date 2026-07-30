import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AnalyticsFilters, TrendRange } from '../types/analytics.types';

interface FiltersState extends AnalyticsFilters {
  setRange: (range: TrendRange) => void;
  setCustom: (from: string | undefined, to: string | undefined) => void;
  setFilter: (key: 'language' | 'genre' | 'country' | 'platform', value: string) => void;
  reset: () => void;
}

const DEFAULTS: AnalyticsFilters = { range: '30d' };

/**
 * Selected date range + filters for the analytics dashboard (docs 24 — Zustand
 * for the selected date range; server data stays in TanStack Query). Persisted so
 * the admin's window survives reloads and applies across every section.
 */
export const useAnalyticsFilters = create<FiltersState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setRange: (range) => set({ range }),
      setCustom: (from, to) => set({ range: 'custom', from, to }),
      setFilter: (key, value) => set({ [key]: value === '' ? undefined : value }),
      reset: () =>
        set({
          ...DEFAULTS,
          from: undefined,
          to: undefined,
          language: undefined,
          genre: undefined,
          country: undefined,
          platform: undefined,
        }),
    }),
    { name: 'qalam-admin-analytics-filters' },
  ),
);

/**
 * The wire filters as a MEMOIZED object (stable identity across renders unless a
 * value changes) — safe to pass straight into a query hook without churn.
 */
export function useAnalyticsFilterValues(): AnalyticsFilters {
  const range = useAnalyticsFilters((state) => state.range);
  const from = useAnalyticsFilters((state) => state.from);
  const to = useAnalyticsFilters((state) => state.to);
  const language = useAnalyticsFilters((state) => state.language);
  const genre = useAnalyticsFilters((state) => state.genre);
  const country = useAnalyticsFilters((state) => state.country);
  const platform = useAnalyticsFilters((state) => state.platform);
  return useMemo(
    () => ({ range, from, to, language, genre, country, platform }),
    [range, from, to, language, genre, country, platform],
  );
}
