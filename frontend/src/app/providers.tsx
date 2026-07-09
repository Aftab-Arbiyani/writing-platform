import { getAntdTheme } from '@qalam/ui';
import { MotionProvider } from '@qalam/ui/motion';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { App as AntApp, ConfigProvider } from 'antd';
import { useEffect, type PropsWithChildren, type ReactElement } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { HelmetProvider } from 'react-helmet-async';

import { RootErrorFallback } from '@/app/error-boundary';
import { reportError } from '@/app/sentry';
import { setUnauthorizedHandler } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';

/**
 * Provider composition (order matters):
 *   ErrorBoundary → Helmet → Query → AntD ConfigProvider (theme+direction) → AntD App
 *   (message/notification/modal context for useToast/useConfirm) → MotionProvider → app.
 *
 * The theme store owns `data-theme` on <html> (Tailwind side); we feed the same resolved
 * mode into AntD's algorithm — one token source, two consumers (docs/00 §6). Chrome is LTR
 * until i18n; content RTL is per-node in the reader/editor.
 */
export function AppProviders({ children }: PropsWithChildren): ReactElement {
  const resolved = useThemeStore((state) => state.resolved);

  useEffect(() => {
    // Terminal 401 → clear session; guards then redirect to login (docs/32 §3).
    setUnauthorizedHandler(() => {
      useAuthStore.getState().clear();
    });
    // F1 has no auth bootstrap yet: resolve the boot check to "no session" so guarded routes
    // stop showing the loader. The auth epic replaces this with a real /auth/refresh probe.
    if (useAuthStore.getState().status === 'unknown') {
      useAuthStore.getState().setAnonymous();
    }
  }, []);

  return (
    <ErrorBoundary FallbackComponent={RootErrorFallback} onError={reportError}>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <ConfigProvider theme={getAntdTheme(resolved)} direction="ltr">
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
