import type { PropsWithChildren, ReactElement } from 'react';

import { getAntdTheme } from '@qalam/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ConfigProvider } from 'antd';

import { queryClient } from '@/lib/query-client';
import { useThemeStore } from '@/stores/theme.store';

/**
 * Global provider composition. Order matters:
 * QueryClientProvider (server state) → AntD ConfigProvider (theme/direction) → app.
 *
 * The zustand theme store owns the `data-theme` attribute on <html> (Tailwind side);
 * subscribing to `resolved` here feeds the same mode into AntD's theme algorithm —
 * one token source, two consumers, zero drift (docs/00 §6).
 */
export function AppProviders({ children }: PropsWithChildren): ReactElement {
  const resolved = useThemeStore((state) => state.resolved);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={getAntdTheme(resolved)}
        // UI chrome is LTR until react-i18next lands in Phase 1 (with a locale store
        // driving this prop). Content-level RTL (Urdu pieces) is a per-piece `dir`
        // concern in the reader/editor, independent of UI direction (docs/00 §6).
        direction="ltr"
      >
        {children}
      </ConfigProvider>
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
