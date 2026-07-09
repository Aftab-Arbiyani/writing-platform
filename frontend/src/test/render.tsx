import { render, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';

/**
 * Test harness mirroring the app provider stack that pages depend on: a fresh QueryClient
 * (retries off — deterministic), AntD `ConfigProvider` + `App` (for `useToast`/`useConfirm`),
 * and a `MemoryRouter` (for `Link`/`useNavigate`/`useSearchParams`). MSW is not used; tests
 * mock the feature `api/` layer — the boundary we own (docs/32 §10).
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
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <AntApp>
            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
          </AntApp>
        </ConfigProvider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
