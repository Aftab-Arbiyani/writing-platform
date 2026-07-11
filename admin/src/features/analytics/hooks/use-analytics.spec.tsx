import { Role } from '@qalam/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';

import { analyticsApi } from '../api/analytics.api';
import type { AnalyticsFilters } from '../types/analytics.types';
import { useOverview, useSystemAnalytics, useUserAnalytics } from './use-analytics';

vi.mock('../api/analytics.api', () => ({
  analyticsApi: {
    overview: vi.fn(),
    users: vi.fn(),
    system: vi.fn(),
  },
}));

function wrapper({ children }: { children: ReactNode }): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const FILTERS: AnalyticsFilters = { range: '30d' };

describe('analytics hooks', () => {
  beforeEach(() => useAuthStore.setState({ status: 'authenticated', role: Role.Admin }));
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.clearAllMocks();
  });

  it('overview fetches with the filters for an admin', async () => {
    (analyticsApi.overview as Mock).mockResolvedValue({ totalUsers: 1 });
    const { result } = renderHook(() => useOverview(FILTERS), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(analyticsApi.overview).toHaveBeenCalledWith(FILTERS, expect.anything());
  });

  it('users + system fetch for an admin', async () => {
    (analyticsApi.users as Mock).mockResolvedValue({ registrations: 3 });
    (analyticsApi.system as Mock).mockResolvedValue({ queues: [] });
    const users = renderHook(() => useUserAnalytics(FILTERS), { wrapper });
    const system = renderHook(() => useSystemAnalytics(), { wrapper });
    await waitFor(() => expect(users.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(system.result.current.isSuccess).toBe(true));
    expect(analyticsApi.users).toHaveBeenCalled();
    expect(analyticsApi.system).toHaveBeenCalled();
  });

  it('stays idle for a moderator (analytics.view is admin+)', async () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Moderator });
    const { result } = renderHook(() => useOverview(FILTERS), { wrapper });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(analyticsApi.overview).not.toHaveBeenCalled();
  });
});
