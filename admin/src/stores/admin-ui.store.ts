import { create } from 'zustand';

/**
 * App-wide admin UI state (client state → Zustand; docs/00 §6). Transient chrome flags only — never
 * server data, never persisted. The foundation wires the global-search and quick-action surfaces as
 * placeholders; feature epics fill them in.
 */
interface AdminUiState {
  /** Global command/search palette open state (placeholder surface in A1). */
  searchOpen: boolean;
  /** Quick-action menu open state (placeholder surface in A1). */
  quickActionOpen: boolean;
  setSearchOpen: (value: boolean) => void;
  setQuickActionOpen: (value: boolean) => void;
}

export const useAdminUiStore = create<AdminUiState>((set) => ({
  searchOpen: false,
  quickActionOpen: false,
  setSearchOpen: (value) => set({ searchOpen: value }),
  setQuickActionOpen: (value) => set({ quickActionOpen: value }),
}));
