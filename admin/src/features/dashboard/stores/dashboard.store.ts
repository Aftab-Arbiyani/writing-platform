import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Dashboard UI preferences (client state → Zustand; docs/24). Holds ONLY view prefs — the selected
 * time range and which widgets the operator has collapsed. All dashboard NUMBERS live in TanStack
 * Query, never here. Persisted so preferences survive reloads.
 */
export type TimeRange = 'today' | '7d' | '30d' | 'custom';

interface DashboardUiState {
  timeRange: TimeRange;
  /** ISO dates for the custom range (only meaningful when timeRange === 'custom'). */
  customFrom: string | null;
  customTo: string | null;
  collapsedWidgets: string[];
  setTimeRange: (range: TimeRange) => void;
  setCustomRange: (from: string | null, to: string | null) => void;
  toggleWidget: (id: string) => void;
}

export const useDashboardStore = create<DashboardUiState>()(
  persist(
    (set) => ({
      timeRange: '7d',
      customFrom: null,
      customTo: null,
      collapsedWidgets: [],
      setTimeRange: (range) => set({ timeRange: range }),
      setCustomRange: (from, to) => set({ customFrom: from, customTo: to, timeRange: 'custom' }),
      toggleWidget: (id) =>
        set((state) => ({
          collapsedWidgets: state.collapsedWidgets.includes(id)
            ? state.collapsedWidgets.filter((widget) => widget !== id)
            : [...state.collapsedWidgets, id],
        })),
    }),
    { name: 'qalam-admin-dashboard' },
  ),
);
