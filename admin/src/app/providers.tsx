import { getAntdTheme } from '@qalam/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ConfigProvider } from 'antd';
import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

import { queryClient } from '@/lib/query-client';
import { useThemeStore } from '@/stores/theme.store';
import type { ResolvedTheme } from '@/stores/theme.store';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

function subscribeToSystemTheme(onChange: () => void): () => void {
  const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

function useResolvedTheme(): ResolvedTheme {
  const mode = useThemeStore((state) => state.mode);
  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemTheme,
    () => window.matchMedia(DARK_MEDIA_QUERY).matches,
  );
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Composition root for app-wide providers. One token source: getAntdTheme maps
 * the shared --q-* tokens onto AntD's ConfigProvider (dark algorithm included),
 * while Tailwind reads the same tokens via @qalam/ui — no drift (docs/00 §6).
 */
export function AppProviders({ children }: AppProvidersProps) {
  const resolvedTheme = useResolvedTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={getAntdTheme(resolvedTheme)} componentSize="middle">
        {children}
      </ConfigProvider>
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
