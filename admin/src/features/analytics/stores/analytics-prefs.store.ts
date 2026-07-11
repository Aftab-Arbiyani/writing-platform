import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PrefsState {
  /** Dashboard preference: denser card layout. */
  compact: boolean;
  /** Chart preference: show chart legends. */
  showLegends: boolean;
  toggleCompact: () => void;
  toggleLegends: () => void;
}

/**
 * Dashboard + chart preferences for the analytics dashboard (docs 24 — Zustand
 * for dashboard/chart prefs only). Persisted; never holds server data.
 */
export const useAnalyticsPrefs = create<PrefsState>()(
  persist(
    (set) => ({
      compact: false,
      showLegends: true,
      toggleCompact: () => set((state) => ({ compact: !state.compact })),
      toggleLegends: () => set((state) => ({ showLegends: !state.showLegends })),
    }),
    { name: 'qalam-admin-analytics-prefs' },
  ),
);
