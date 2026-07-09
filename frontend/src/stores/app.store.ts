import { create } from 'zustand';

/**
 * App-wide client/UI state (docs/12 §3): network status + session-scoped chrome flags.
 * Slice-per-concern; no server data here. Not persisted. Subscribe with narrow selectors
 * (`useAppStore(s => s.isOnline)`) — bare `useAppStore()` re-renders on every change.
 */
interface AppState {
  isOnline: boolean;
  /** Mobile nav drawer open state (bottom-tab / hamburger surfaces). */
  mobileNavOpen: boolean;
  setOnline: (value: boolean) => void;
  setMobileNavOpen: (value: boolean) => void;
  toggleMobileNav: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  mobileNavOpen: false,
  setOnline: (value) => {
    set({ isOnline: value });
  },
  setMobileNavOpen: (value) => {
    set({ mobileNavOpen: value });
  },
  toggleMobileNav: () => {
    set((state) => ({ mobileNavOpen: !state.mobileNavOpen }));
  },
}));

// Keep `isOnline` live (SPA — window exists at module load). Powers the offline banner/page.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useAppStore.getState().setOnline(true);
  });
  window.addEventListener('offline', () => {
    useAppStore.getState().setOnline(false);
  });
}
