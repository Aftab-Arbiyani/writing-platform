import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { moderationApi } from '../api/moderation.api';
import { useBulkReports, useResolveReport } from './use-moderation-mutations';

vi.mock('../api/moderation.api', () => ({
  moderationApi: { resolve: vi.fn(), bulk: vi.fn() },
}));

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => vi.clearAllMocks());

describe('moderation mutations', () => {
  it('resolve calls the endpoint and invalidates the moderation cache', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    (moderationApi.resolve as Mock).mockResolvedValue({ id: 'r1', status: 'resolved' });

    const { result } = renderHook(() => useResolveReport(), { wrapper: makeWrapper(client) });
    act(() => result.current.mutate({ id: 'r1', payload: { resolution: 'content_hidden' } }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(moderationApi.resolve).toHaveBeenCalledWith('r1', { resolution: 'content_hidden' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['moderation'] });
  });

  it('bulk calls the endpoint and invalidates', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    (moderationApi.bulk as Mock).mockResolvedValue({
      action: 'reject',
      requested: 2,
      succeeded: ['r1', 'r2'],
      failed: [],
    });

    const { result } = renderHook(() => useBulkReports(), { wrapper: makeWrapper(client) });
    act(() => result.current.mutate({ action: 'reject', reportIds: ['r1', 'r2'] }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['moderation'] });
  });
});
