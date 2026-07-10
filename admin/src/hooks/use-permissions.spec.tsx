import { Role } from '@qalam/shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/stores/auth.store';

describe('usePermissions', () => {
  it('treats role floors as a rank comparison (super_admin satisfies everything)', () => {
    useAuthStore.getState().setSession({ name: 'A', email: 'a@x', role: Role.SuperAdmin });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.hasRole(Role.Admin)).toBe(true);
    expect(result.current.hasRole(Role.Moderator)).toBe(true);
    expect(result.current.can('user.suspend')).toBe(true); // wildcard grant
  });

  it('denies a role floor above the current role', () => {
    useAuthStore.getState().setSession({ name: 'M', email: 'm@x', role: Role.Moderator });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.hasRole(Role.Moderator)).toBe(true);
    expect(result.current.hasRole(Role.Admin)).toBe(false);
    expect(result.current.hasRole(Role.SuperAdmin)).toBe(false);
  });

  it('reports no access when unauthenticated', () => {
    useAuthStore.getState().clearSession();
    const { result } = renderHook(() => usePermissions());
    expect(result.current.role).toBeNull();
    expect(result.current.hasRole(Role.Moderator)).toBe(false);
  });
});
