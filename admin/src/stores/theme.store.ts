import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Theme slice (client state → Zustand per docs/00 §6). Persisted under
 * 'qalam-admin-theme' — the same key the anti-flash script in index.html reads
 * before first paint. Dark mode is class-strategy: `data-theme` on <html>,
 * consumed by @qalam/ui tokens.css and the AntD dark algorithm.
 */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
  }
  return mode;
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', resolveTheme(mode));
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => {
        applyTheme(mode);
        set({ mode });
      },
    }),
    {
      name: 'qalam-admin-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.mode);
      },
    },
  ),
);

// Keep `data-theme` in sync when the OS preference changes while in 'system' mode.
if (typeof window !== 'undefined') {
  window.matchMedia(DARK_MEDIA_QUERY).addEventListener('change', () => {
    if (useThemeStore.getState().mode === 'system') applyTheme('system');
  });
}
