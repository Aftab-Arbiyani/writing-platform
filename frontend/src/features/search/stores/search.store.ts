import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { STORAGE_KEYS } from '@/lib/constants';

/**
 * Search CLIENT/UI state (hard-rule #4, docs/12 §3) — the ONLY search state that lives in
 * Zustand. Everything a URL can carry (the query, active tab, filters) stays in the URL
 * (`useSearchQueryParams`); everything the server owns (results, suggestions, trending, the
 * authenticated recent list) stays in TanStack Query. What remains — and belongs here — is:
 *
 *  1. **Recent searches** — a device-local, persisted history. It is the sole recent list for
 *     signed-out visitors (the server `/search/recent` endpoint needs auth) and a write-through
 *     cache/mirror for signed-in users, so a search shows up instantly without a round-trip.
 *  2. **Ephemeral shell UI** — the global command dropdown's open state and the mobile
 *     filter-panel (bottom sheet) open state. Neither belongs in the URL (not shareable) nor on
 *     the server.
 *
 * Subscribe with narrow selectors (`useSearchStore(s => s.recent)`); a bare call re-renders on
 * every change. Only `recent` is persisted (`partialize`).
 */

/** How many device-local recent queries to keep (mirrors the server cap of 20 loosely). */
export const RECENT_SEARCH_LIMIT = 10;

interface SearchState {
  /** Device-local recent queries, most-recent-first, de-duplicated (case-insensitive), capped. */
  recent: string[];
  /** Global search command dropdown (top bar) open state. */
  commandOpen: boolean;
  /** Mobile filter bottom-sheet open state (the desktop bar shows filters inline). */
  filterPanelOpen: boolean;

  /** Record an executed query at the top of the local history (no-op for blank input). */
  addRecent: (query: string) => void;
  /** Forget one local query (case-insensitive match). */
  removeRecent: (query: string) => void;
  /** Clear the entire local history. */
  clearRecent: () => void;

  openCommand: () => void;
  closeCommand: () => void;
  setCommandOpen: (open: boolean) => void;

  openFilterPanel: () => void;
  closeFilterPanel: () => void;
  toggleFilterPanel: () => void;
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      recent: [],
      commandOpen: false,
      filterPanelOpen: false,

      addRecent: (query) => {
        const trimmed = query.trim();
        if (trimmed.length === 0) return;
        set((state) => {
          const withoutDupe = state.recent.filter(
            (q) => q.toLocaleLowerCase() !== trimmed.toLocaleLowerCase(),
          );
          return { recent: [trimmed, ...withoutDupe].slice(0, RECENT_SEARCH_LIMIT) };
        });
      },
      removeRecent: (query) => {
        set((state) => ({
          recent: state.recent.filter((q) => q.toLocaleLowerCase() !== query.toLocaleLowerCase()),
        }));
      },
      clearRecent: () => {
        set({ recent: [] });
      },

      openCommand: () => {
        set({ commandOpen: true });
      },
      closeCommand: () => {
        set({ commandOpen: false });
      },
      setCommandOpen: (open) => {
        set({ commandOpen: open });
      },

      openFilterPanel: () => {
        set({ filterPanelOpen: true });
      },
      closeFilterPanel: () => {
        set({ filterPanelOpen: false });
      },
      toggleFilterPanel: () => {
        set((state) => ({ filterPanelOpen: !state.filterPanelOpen }));
      },
    }),
    {
      name: STORAGE_KEYS.recentSearches,
      // Persist history only; the open-state flags are session-scoped chrome.
      partialize: (state) => ({ recent: state.recent }),
    },
  ),
);
