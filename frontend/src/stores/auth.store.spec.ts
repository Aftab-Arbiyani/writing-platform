import { Role } from '@qalam/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { getAccessToken } from '@/lib/api-client';

import { useAuthStore } from './auth.store';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
  });

  it('setSession stashes the token, role, and verified flag; status → authenticated', () => {
    useAuthStore.getState().setSession({
      accessToken: 'abc',
      role: Role.User,
      isEmailVerified: false,
    });
    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.role).toBe(Role.User);
    expect(state.isEmailVerified).toBe(false);
    expect(getAccessToken()).toBe('abc');
  });

  it('isEmailVerified defaults to null (unknown) when omitted', () => {
    useAuthStore.getState().setSession({ accessToken: 'abc', role: Role.User });
    expect(useAuthStore.getState().isEmailVerified).toBeNull();
  });

  it('setEmailVerified flips just the verified flag', () => {
    useAuthStore.getState().setSession({ accessToken: 'abc', role: Role.User });
    useAuthStore.getState().setEmailVerified(true);
    expect(useAuthStore.getState().isEmailVerified).toBe(true);
  });

  it('expireSession clears the token and raises the "expired" reason', () => {
    useAuthStore.getState().setSession({ accessToken: 'abc', role: Role.User });
    useAuthStore.getState().expireSession();
    const state = useAuthStore.getState();
    expect(state.status).toBe('anonymous');
    expect(state.sessionExpired).toBe(true);
    expect(getAccessToken()).toBeNull();
  });

  it('clear (explicit logout) does NOT raise the expired reason', () => {
    useAuthStore.getState().expireSession();
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().sessionExpired).toBe(false);
  });

  it('clearSessionExpired acknowledges the reason', () => {
    useAuthStore.getState().expireSession();
    useAuthStore.getState().clearSessionExpired();
    expect(useAuthStore.getState().sessionExpired).toBe(false);
  });
});
