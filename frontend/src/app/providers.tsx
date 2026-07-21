import { getAntdTheme } from '@qalam/ui';
import { MotionProvider } from '@qalam/ui/motion';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { App as AntApp, ConfigProvider } from 'antd';
import { useEffect, useMemo, useRef, type PropsWithChildren, type ReactElement } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { HelmetProvider } from 'react-helmet-async';

import { RootErrorFallback } from '@/app/error-boundary';
import { reportError } from '@/app/sentry';
import { bootstrapSession } from '@/features/auth/lib/session';
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
  // Memoize the AntD theme object (P7.3): `getAntdTheme` builds a fresh token
  // object each call; without this it changes identity on every render and
  // re-renders the entire AntD tree. Now it only changes when the resolved mode
  // flips (light↔dark).
  const antdTheme = useMemo(() => getAntdTheme(resolved), [resolved]);
  // Ensures the boot refresh fires ONCE even under StrictMode's double-invoke (a second
  // /auth/refresh would rotate the token twice → reuse-detection). The ref persists across
  // StrictMode's setup→cleanup→setup on the same instance.
  const booted = useRef(false);

  useEffect(() => {
    // Terminal 401 (a live session's token went invalid and refresh failed) → end the session
    // with the "expired" reason + drop the user-scoped cache; guards bounce to login, which
    // shows the reason (docs/32 §3.2). `/auth/*` 401s are excluded in the client and never
    // reach here.
    setUnauthorizedHandler(() => {
      useAuthStore.getState().expireSession();
      queryClient.clear();
    });
    // Boot session restore: one silent /auth/refresh (docs/32 §3.1). Resolves the status to
    // authenticated | anonymous so guards stop showing the loader; never throws.
    if (!booted.current && useAuthStore.getState().status === 'unknown') {
      booted.current = true;
      void bootstrapSession();
    }
  }, []);

  return (
    <ErrorBoundary FallbackComponent={RootErrorFallback} onError={reportError}>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <ConfigProvider theme={antdTheme} direction="ltr">
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
