import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_SECTION } from '../settings.constants';

interface SettingsUiState {
  /** Compact field layout (UI preference). */
  compact: boolean;
  toggleCompact: () => void;
  /** Last section the admin viewed — restored when navigating in without `?section`. */
  lastSection: string;
  setLastSection: (section: string) => void;
}

/**
 * Persisted Settings UI preferences (docs 24 — Zustand for UI prefs + selected
 * section only; server state stays in TanStack Query). The URL `?section=` is the
 * live source of truth for the active section (house rule — URL owns tabs);
 * `lastSection` here just seeds the default when none is in the URL.
 */
export const useSettingsUi = create<SettingsUiState>()(
  persist(
    (set) => ({
      compact: false,
      toggleCompact: () => set((state) => ({ compact: !state.compact })),
      lastSection: DEFAULT_SECTION,
      setLastSection: (section) => set({ lastSection: section }),
    }),
    { name: 'qalam-admin-settings' },
  ),
);
