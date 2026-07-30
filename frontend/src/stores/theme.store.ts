import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// This app is a pure SPA (Vite, no SSR), so touching `window`/`document` at module
// scope is safe — no server-side guards needed. The inline script in index.html
// applies data-theme before the bundle loads; this store owns it from then on.

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  /** User preference — persisted under the 'qalam-theme' key. */
  mode: ThemeMode;
  /** What is actually rendered ('system' resolved via matchMedia). Derived — not persisted. */
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

const resolve = (mode: ThemeMode): ResolvedTheme =>
  mode === 'system' ? (darkQuery.matches ? 'dark' : 'light') : mode;

/** The store is the single writer of the data-theme attribute after boot. */
const applyDomTheme = (resolved: ResolvedTheme): void => {
  document.documentElement.setAttribute('data-theme', resolved);
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      resolved: resolve('system'),
      setMode: (mode) => {
        const resolved = resolve(mode);
        applyDomTheme(resolved);
        set({ mode, resolved });
      },
    }),
    {
      name: 'qalam-theme',
      // Persist the preference only; `resolved` is recomputed on every boot.
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        // Recompute `resolved` from the rehydrated mode and sync the DOM attribute
        // (the persisted snapshot may have been written under a different OS theme).
        if (state) state.setMode(state.mode);
      },
    },
  ),
);

// Follow OS theme changes live while the user preference is 'system'.
darkQuery.addEventListener('change', () => {
  const { mode, setMode } = useThemeStore.getState();
  if (mode === 'system') setMode('system');
});
