import { PERMISSIONS, Role } from '@qalam/shared';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { RequirePermission } from '@/app/guards/require-permission';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

/**
 * The `billing.manage` route gate (A1) — the RBAC half of "an operator without the grant cannot reach
 * the monetization routes". The nav-hiding half is a role floor and is covered by the sidebar; this is
 * the gate that decides whether the URL works if typed.
 */
function renderAt(role: Role) {
  useAuthStore.setState({ status: 'authenticated', role });
  return renderWithProviders(
    <Routes>
      <Route element={<RequirePermission require={PERMISSIONS.BillingManage} />}>
        <Route path="/x" element={<div>protected</div>} />
      </Route>
    </Routes>,
    { route: '/x' },
  );
}

afterEach(() => useAuthStore.getState().clear());

describe('RequirePermission (route guard)', () => {
  it('lets an admin through — billing.* is on the Admin grant set', () => {
    renderAt(Role.Admin);
    expect(screen.getByText('protected')).toBeInTheDocument();
  });

  it('lets a super-admin through via the wildcard grant', () => {
    renderAt(Role.SuperAdmin);
    expect(screen.getByText('protected')).toBeInTheDocument();
  });

  it('403s a moderator, who holds no billing grant', () => {
    // An honest 403 page, not a redirect — same posture as `RequireRole`. This is the assertion the
    // A1 RBAC requirement rests on: no billing.manage, no route.
    renderAt(Role.Moderator);
    expect(screen.getByText(/access to this/i)).toBeInTheDocument();
    expect(screen.queryByText('protected')).not.toBeInTheDocument();
  });

  it('403s an ordinary user', () => {
    renderAt(Role.User);
    expect(screen.queryByText('protected')).not.toBeInTheDocument();
  });

  it('sends an anonymous visitor to login rather than showing a 403', () => {
    useAuthStore.setState({ status: 'anonymous', role: null });
    renderWithProviders(
      <Routes>
        <Route element={<RequirePermission require={PERMISSIONS.BillingManage} />}>
          <Route path="/x" element={<div>protected</div>} />
        </Route>
        <Route path="/login" element={<div>login</div>} />
      </Routes>,
      { route: '/x' },
    );
    expect(screen.getByText('login')).toBeInTheDocument();
  });
});
