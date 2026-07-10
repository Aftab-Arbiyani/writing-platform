import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { App as AntApp, ConfigProvider } from 'antd';
import type { ReactElement, ReactNode } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router';

/**
 * Test harness mirroring the admin provider stack pages depend on: a fresh QueryClient (retries off
 * — deterministic), `HelmetProvider`, AntD `ConfigProvider` + `App` (message/notification/modal
 * context), and a `MemoryRouter` (Link/useNavigate/useSearchParams). Tests mock the feature `api/`
 * layer — the boundary we own (docs/32 §10).
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/' }: { route?: string } = {},
): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return (
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <ConfigProvider>
            <AntApp>
              <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
            </AntApp>
          </ConfigProvider>
        </QueryClientProvider>
      </HelmetProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
