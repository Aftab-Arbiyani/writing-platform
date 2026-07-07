import { Segmented } from 'antd';
import { Monitor, Moon, Sun } from 'lucide-react';

import { useThemeStore } from '@/stores/theme.store';
import type { ThemeMode } from '@/stores/theme.store';

/**
 * Temporary placeholder — replaced by the real /dashboard in Phase 1.
 * Exists only to prove the foundation wires up: tokens, Tailwind utilities,
 * AntD theming, and the persisted theme store.
 */
export default function PlaceholderDashboard() {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[var(--q-bg-canvas)] p-8 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-[1.5625rem] font-semibold text-[var(--q-text-primary)]">
          Qalam Admin — foundation scaffold
        </h1>
        <p className="text-sm text-[var(--q-text-secondary)]">
          Workbench shell is wired: tokens, AntD theme, router, query client. Admin sections arrive
          in Phase 1.
        </p>
      </div>

      <Segmented<ThemeMode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'light', label: 'Light', icon: <Sun size={14} aria-hidden /> },
          { value: 'system', label: 'System', icon: <Monitor size={14} aria-hidden /> },
          { value: 'dark', label: 'Dark', icon: <Moon size={14} aria-hidden /> },
        ]}
      />

      <p className="text-xs text-[var(--q-text-muted)]">
        Theme persists under <code>qalam-admin-theme</code>.
      </p>
    </main>
  );
}
