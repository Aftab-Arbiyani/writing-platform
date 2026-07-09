import { useCallback } from 'react';

import { useThemeStore, type ResolvedTheme, type ThemeMode } from '@/stores/theme.store';

export interface UseThemeResult {
  /** User preference. */
  mode: ThemeMode;
  /** Actually-rendered theme (system resolved). */
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  /** Flip between light/dark based on what's currently rendered. */
  toggle: () => void;
}

/** Ergonomic accessor over the persisted theme store (docs/12 §3). */
export function useTheme(): UseThemeResult {
  const mode = useThemeStore((state) => state.mode);
  const resolved = useThemeStore((state) => state.resolved);
  const setMode = useThemeStore((state) => state.setMode);
  const toggle = useCallback(() => {
    setMode(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setMode]);
  return { mode, resolved, setMode, toggle };
}
