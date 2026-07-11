import { Role } from '@qalam/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';

import { auditApi } from '../api/audit.api';
import { useAuditLogs, useAuditStatistics } from './use-audit';

vi.mock('../api/audit.api', () => ({
  auditApi: { list: vi.fn(), detail: vi.fn(), statistics: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAuditLogs', () => {
  beforeEach(() => useAuthStore.setState({ status: 'authenticated', role: Role.Admin }));
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.clearAllMocks();
  });

  it('fetches audit logs with the given params for an admin', async () => {
    (auditApi.list as Mock).mockResolvedValue({
      items: [{ id: 'a1' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const { result } = renderHook(() => useAuditLogs({ page: 1, limit: 20, action: 'user.ban' }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(auditApi.list).toHaveBeenCalledWith(
      { page: 1, limit: 20, action: 'user.ban' },
      expect.anything(),
    );
  });

  it('does not fire for a moderator (admin.dashboard is admin-only)', async () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Moderator });
    const { result } = renderHook(() => useAuditLogs({ page: 1, limit: 20 }), { wrapper });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(auditApi.list).not.toHaveBeenCalled();
  });
});

describe('useAuditStatistics', () => {
  beforeEach(() => useAuthStore.setState({ status: 'authenticated', role: Role.Admin }));
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.clearAllMocks();
  });

  it('fetches statistics for an admin', async () => {
    (auditApi.statistics as Mock).mockResolvedValue({
      today: 3,
      thisWeek: 9,
      thisMonth: 40,
      topActions: [],
      mostActiveActors: [],
    });
    const { result } = renderHook(() => useAuditStatistics(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(auditApi.statistics).toHaveBeenCalled();
  });
});
