import { Role } from '@qalam/shared';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { setRemember } from '@/lib/remember';
import { useAuthStore } from '@/stores/auth.store';

vi.mock('../api/auth.api', () => ({ authApi: { refresh: vi.fn() } }));

import { authApi } from '../api/auth.api';
import { bootstrapSession } from './session';

function makeToken(role: string): string {
  const b64 = (obj: object): string =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `x.${b64({ sub: 'u1', role, sv: 1, exp: 9999999999 })}.sig`;
}

beforeEach(() => {
  useAuthStore.setState({ status: 'unknown', role: null, sessionExpired: false });
  setRemember(false);
  vi.clearAllMocks();
});

describe('bootstrapSession', () => {
  it('resolves to anonymous WITHOUT calling refresh when remember-me is off', async () => {
    setRemember(false);
    await bootstrapSession();
    expect(authApi.refresh).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('restores an authenticated session (role from JWT) when remember-me is on and refresh succeeds', async () => {
    setRemember(true);
    (authApi.refresh as Mock).mockResolvedValue({ accessToken: makeToken(Role.Admin) });
    await bootstrapSession();
    expect(authApi.refresh).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().role).toBe(Role.Admin);
  });

  it('resolves to anonymous when refresh fails', async () => {
    setRemember(true);
    (authApi.refresh as Mock).mockRejectedValue(new Error('401'));
    await bootstrapSession();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });
});
