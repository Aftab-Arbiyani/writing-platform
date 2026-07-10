import { getAntdTheme } from '@qalam/ui';
import { MotionProvider } from '@qalam/ui/motion';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { App as AntApp, ConfigProvider } from 'antd';
import { useEffect, useRef, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { HelmetProvider } from 'react-helmet-async';

import { RootErrorFallback } from '@/app/error-boundary';
import { reportError } from '@/app/sentry';
import { bootstrapSession } from '@/features/auth';
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
  // Ensures the boot refresh fires ONCE under StrictMode's double-invoke — a second /auth/refresh
  // would rotate the refresh token twice and trip reuse detection.
  const booted = useRef(false);

  useEffect(() => {
    // An unrecoverable 401 raises the "session expired" reason; the SessionExpiredDialog handles it.
    setUnauthorizedHandler(() => {
      useAuthStore.getState().expireSession();
    });
    // Boot session restore: one silent /auth/refresh (docs/32 §3.1). Resolves status to
    // authenticated | anonymous so guards stop showing the loader; never throws.
    if (!booted.current && useAuthStore.getState().status === 'unknown') {
      booted.current = true;
      void bootstrapSession();
    }
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
