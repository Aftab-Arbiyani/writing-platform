import { PERMISSIONS, Role } from '@qalam/shared';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';

import { usePermission } from './use-permission';

/**
 * `usePermission` is an affordance HINT, and the thing worth pinning is that it mirrors the
 * server's resolution rather than a naive table lookup: grants stack with every lower-ranked role
 * (`permission.resolver.ts:50-54`). A version that read `DEFAULT_ROLE_PERMISSIONS[role]` alone
 * would hide "Write a response" from every moderator and admin, all of whom hold `piece.create`.
 */
describe('usePermission', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
  });

  function signIn(role: Role): void {
    useAuthStore.getState().setSession({ accessToken: 'token', role });
  }

  it('denies an anonymous viewer', () => {
    useAuthStore.setState({ status: 'anonymous', role: null });
    const { result } = renderHook(() => usePermission(PERMISSIONS.PieceCreate));
    expect(result.current).toBe(false);
  });

  it('denies while the session is still unknown, rather than flashing an affordance', () => {
    useAuthStore.setState({ status: 'unknown', role: Role.User });
    const { result } = renderHook(() => usePermission(PERMISSIONS.PieceCreate));
    expect(result.current).toBe(false);
  });

  it('grants piece.create to an ordinary user', () => {
    signIn(Role.User);
    const { result } = renderHook(() => usePermission(PERMISSIONS.PieceCreate));
    expect(result.current).toBe(true);
  });

  it('grants piece.create to a moderator by rank inheritance, not by its own grant list', () => {
    // `DEFAULT_ROLE_PERMISSIONS[moderator]` does NOT contain `piece.create` — the moderator holds
    // it because a role inherits every lower-ranked role's grants. This is the case a naive lookup
    // gets wrong.
    signIn(Role.Moderator);
    const { result } = renderHook(() => usePermission(PERMISSIONS.PieceCreate));
    expect(result.current).toBe(true);
  });

  it('resolves an admin wildcard (`piece.*`) as satisfying piece.create', () => {
    signIn(Role.Admin);
    const { result } = renderHook(() => usePermission(PERMISSIONS.PieceCreate));
    expect(result.current).toBe(true);
  });

  it('resolves the super-admin `*` wildcard', () => {
    signIn(Role.SuperAdmin);
    const { result } = renderHook(() => usePermission('anything.at.all'));
    expect(result.current).toBe(true);
  });

  it('denies a permission no role in the viewer’s chain holds', () => {
    signIn(Role.User);
    const { result } = renderHook(() => usePermission(PERMISSIONS.AdminDashboard));
    expect(result.current).toBe(false);
  });
});
