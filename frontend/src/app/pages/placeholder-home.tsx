import type { ReactElement } from 'react';

import { Monitor, Moon, Sun } from 'lucide-react';

import { useThemeStore, type ThemeMode } from '@/stores/theme.store';

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const MODE_ICON: Record<ThemeMode, ReactElement> = {
  light: <Sun size={16} aria-hidden="true" />,
  dark: <Moon size={16} aria-hidden="true" />,
  system: <Monitor size={16} aria-hidden="true" />,
};

// Route pages are the ONLY default exports in this app: React Router's lazy()
// route groups (Phase 1) code-split on default exports. Everything else is named.
export default function PlaceholderHome(): ReactElement {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas ps-6 pe-6 text-center">
      <h1 className="font-serif text-5xl text-ink">Qalam</h1>
      <p className="mt-4 text-xl text-ink-secondary">A premium writing sanctuary</p>
      <p className="mt-2 text-sm text-ink-muted">
        Foundation scaffold — Phase 1 features arrive next
      </p>

      <button
        type="button"
        onClick={() => setMode(NEXT_MODE[mode])}
        aria-label={`Theme: ${mode}. Activate to switch to ${NEXT_MODE[mode]}.`}
        className="mt-8 inline-flex items-center gap-2 rounded-md border border-line bg-surface ps-4 pe-4 pt-2 pb-2 text-sm text-ink-secondary transition-colors hover:border-accent hover:text-accent"
      >
        {MODE_ICON[mode]}
        <span className="capitalize">{mode}</span>
      </button>
    </main>
  );
}
