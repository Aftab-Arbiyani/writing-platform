import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { usersApi } from '../api/users.api';
import { useBulkUserAction, useUserAction } from './use-user-mutations';

vi.mock('../api/users.api', () => ({
  usersApi: { action: vi.fn(), bulk: vi.fn() },
}));

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => vi.clearAllMocks());

describe('useUserAction', () => {
  it('calls the action endpoint and invalidates the users cache', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    (usersApi.action as Mock).mockResolvedValue({ id: 'u1', action: 'suspend', message: 'ok' });

    const { result } = renderHook(() => useUserAction(), { wrapper: makeWrapper(client) });
    act(() => result.current.mutate({ id: 'u1', action: 'suspend', reason: 'spam' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(usersApi.action).toHaveBeenCalledWith('u1', 'suspend', 'spam');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['users'] });
  });
});

describe('useBulkUserAction', () => {
  it('does not invalidate the cache for an export (non-mutating) run', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    (usersApi.bulk as Mock).mockResolvedValue({
      action: 'export',
      requested: 1,
      succeeded: [],
      failed: [],
      data: [],
    });

    const { result } = renderHook(() => useBulkUserAction(), { wrapper: makeWrapper(client) });
    act(() => result.current.mutate({ action: 'export', userIds: ['u1'] }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(usersApi.bulk).toHaveBeenCalledWith('export', ['u1'], undefined);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('invalidates the cache after a mutating bulk action', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    (usersApi.bulk as Mock).mockResolvedValue({
      action: 'suspend',
      requested: 2,
      succeeded: ['u1', 'u2'],
      failed: [],
    });

    const { result } = renderHook(() => useBulkUserAction(), { wrapper: makeWrapper(client) });
    act(() => result.current.mutate({ action: 'suspend', userIds: ['u1', 'u2'] }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['users'] });
  });
});
