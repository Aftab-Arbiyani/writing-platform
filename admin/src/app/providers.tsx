import { getAntdTheme } from '@qalam/ui';
import { MotionProvider } from '@qalam/ui/motion';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { App as AntApp, ConfigProvider } from 'antd';
import { useEffect, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { HelmetProvider } from 'react-helmet-async';

import { RootErrorFallback } from '@/app/error-boundary';
import { reportError } from '@/app/sentry';
import { setUnauthorizedHandler } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore, type ResolvedTheme } from '@/stores/theme.store';

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
    () => false,
  );
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Composition root (order matters):
 *   ErrorBoundary → Helmet → Query → AntD ConfigProvider (theme + LTR) → AntD App
 *   (message/notification/modal context) → MotionProvider → app.
 *
 * One token source: `getAntdTheme` maps the shared `--q-*` tokens onto AntD (dark algorithm +
 * overrides), while Tailwind reads the same tokens — no drift (docs/00 §6). Admin chrome is LTR in
 * Phase 1 (`direction="ltr"`), but the codebase stays RTL-ready (logical properties only).
 */
export function AppProviders({ children }: AppProvidersProps): ReactElement {
  const resolvedTheme = useResolvedTheme();

  useEffect(() => {
    // A terminal 401 (refresh failed / non-refreshable auth code) ends the session; guards then
    // bounce to login. Server state is dropped so a re-login never shows a stale operator's data.
    setUnauthorizedHandler(() => {
      useAuthStore.getState().clearSession();
      queryClient.clear();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  return (
    <ErrorBoundary FallbackComponent={RootErrorFallback} onError={reportError}>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <ConfigProvider
            theme={getAntdTheme(resolvedTheme)}
            componentSize="middle"
            direction="ltr"
          >
            <AntApp>
              <MotionProvider>{children}</MotionProvider>
            </AntApp>
          </ConfigProvider>
          {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}
