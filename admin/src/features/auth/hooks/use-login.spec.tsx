import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Role } from '@qalam/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { getRemember, setRemember } from '@/lib/remember';
import { useAuthStore } from '@/stores/auth.store';

vi.mock('../api/auth.api', () => ({
  authApi: { login: vi.fn(), refresh: vi.fn(), logout: vi.fn() },
}));

import { authApi } from '../api/auth.api';
import { useLogin } from './use-login';
import { useLogout } from './use-logout';

function makeToken(role: string): string {
  const b64 = (obj: object): string =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `x.${b64({ sub: 'u1', role, sv: 1, exp: 9999999999 })}.sig`;
}

function wrapper({ children }: { children: ReactNode }): ReactElement {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  useAuthStore.setState({ status: 'unknown', role: null, sessionExpired: false });
  setRemember(false);
  vi.clearAllMocks();
});

describe('useLogin', () => {
  it('establishes the session (role from JWT) and persists remember-me on success', async () => {
    (authApi.login as Mock).mockResolvedValue({
      user: { id: 'u1', email: 'a@x', username: 'ali', isEmailVerified: true },
      accessToken: makeToken(Role.SuperAdmin),
    });
    const { result } = renderHook(() => useLogin(), { wrapper });

    act(() => result.current.mutate({ email: 'a@x', password: 'pw', rememberMe: true }));

    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'));
    expect(useAuthStore.getState().role).toBe(Role.SuperAdmin);
    expect(getRemember()).toBe(true);
  });
});

describe('useLogout', () => {
  it('clears the session locally even if the logout request settles', async () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Admin });
    setRemember(true);
    (authApi.logout as Mock).mockResolvedValue(undefined);
    const { result } = renderHook(() => useLogout(), { wrapper });

    act(() => result.current.mutate());

    await waitFor(() => expect(useAuthStore.getState().status).toBe('anonymous'));
    expect(useAuthStore.getState().role).toBeNull();
    expect(getRemember()).toBe(false);
  });
});
