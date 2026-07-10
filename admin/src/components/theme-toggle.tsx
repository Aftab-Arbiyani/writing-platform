import { Segmented } from 'antd';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { ReactElement } from 'react';

import { useThemeStore, type ThemeMode } from '@/stores/theme.store';

/**
 * Light / System / Dark switch (docs/07 §3). Writes only through the theme store, which owns
 * `data-theme` on `<html>` — components never touch it directly. The choice persists under
 * `qalam-admin-theme` (read by the anti-flash script before first paint).
 */
export function ThemeToggle(): ReactElement {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);

  return (
    <Segmented<ThemeMode>
      size="small"
      value={mode}
      onChange={setMode}
      aria-label="Theme"
      options={[
        { value: 'light', icon: <Sun size={14} aria-label="Light" /> },
        { value: 'system', icon: <Monitor size={14} aria-label="System" /> },
        { value: 'dark', icon: <Moon size={14} aria-label="Dark" /> },
      ]}
    />
  );
}
