import { Role } from '@qalam/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';

import { moderationApi } from '../api/moderation.api';
import { useReports } from './use-reports';

vi.mock('../api/moderation.api', () => ({
  moderationApi: { listReports: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useReports', () => {
  beforeEach(() => useAuthStore.setState({ status: 'authenticated', role: Role.Moderator }));
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.clearAllMocks();
  });

  it('fetches the queue with the given params for a moderator', async () => {
    (moderationApi.listReports as Mock).mockResolvedValue({
      items: [{ id: 'r1' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const { result } = renderHook(() => useReports({ page: 1, limit: 20, status: 'pending' }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(moderationApi.listReports).toHaveBeenCalledWith(
      { page: 1, limit: 20, status: 'pending' },
      expect.anything(),
    );
  });

  it('does not fire without report.view (a plain user)', async () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.User });
    const { result } = renderHook(() => useReports({ page: 1, limit: 20 }), { wrapper });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(moderationApi.listReports).not.toHaveBeenCalled();
  });
});
