import { Role } from '@qalam/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';

import { authApi } from '../api/auth.api';
import { bootstrapSession, establishSession } from './session';
import { getRememberSession } from './remember';

vi.mock('../api/auth.api', () => ({ authApi: { refresh: vi.fn() } }));
vi.mock('./remember', () => ({ getRememberSession: vi.fn() }));

function makeToken(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64url({ typ: 'JWT' })}.${b64url(payload)}.sig`;
}

describe('establishSession', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
  });

  it('decodes the role from the token and marks the session authenticated', () => {
    establishSession(makeToken({ sub: 'u', role: Role.Moderator }), false);
    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.role).toBe(Role.Moderator);
    expect(state.isEmailVerified).toBe(false);
  });
});

describe('bootstrapSession', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
    useAuthStore.setState({ status: 'unknown' });
    vi.clearAllMocks();
  });

  it('skips the refresh and goes anonymous when "remember me" is off', async () => {
    vi.mocked(getRememberSession).mockReturnValue(false);
    await bootstrapSession();
    expect(authApi.refresh).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('restores an authenticated session on a successful silent refresh', async () => {
    vi.mocked(getRememberSession).mockReturnValue(true);
    vi.mocked(authApi.refresh).mockResolvedValue({
      accessToken: makeToken({ sub: 'u', role: Role.User }),
    });
    await bootstrapSession();
    expect(authApi.refresh).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('falls back to visitor mode when the refresh fails (no/expired cookie)', async () => {
    vi.mocked(getRememberSession).mockReturnValue(true);
    vi.mocked(authApi.refresh).mockRejectedValue(new Error('401'));
    await bootstrapSession();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });
});
