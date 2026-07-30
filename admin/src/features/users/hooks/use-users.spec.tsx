import { Role } from '@qalam/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';

import { usersApi } from '../api/users.api';
import { useUsers } from './use-users';

vi.mock('../api/users.api', () => ({
  usersApi: { list: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useUsers', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated', role: Role.SuperAdmin });
  });
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.clearAllMocks();
  });

  it('fetches the list with the given params when permitted', async () => {
    (usersApi.list as Mock).mockResolvedValue({
      items: [{ id: 'u1', username: 'meera' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const { result } = renderHook(() => useUsers({ page: 1, limit: 20, status: 'suspended' }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(usersApi.list).toHaveBeenCalledWith(
      { page: 1, limit: 20, status: 'suspended' },
      expect.anything(),
    );
    expect(result.current.data?.pagination?.total).toBe(1);
  });

  it('does not fire when the operator lacks user.view', async () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.User });
    const { result } = renderHook(() => useUsers({ page: 1, limit: 20 }), { wrapper });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(usersApi.list).not.toHaveBeenCalled();
  });
});
