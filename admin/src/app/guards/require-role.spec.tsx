import { Role } from '@qalam/shared';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { RequireRole } from '@/app/guards/require-role';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

function renderAt(role: Role) {
  useAuthStore.setState({ status: 'authenticated', role });
  return renderWithProviders(
    <Routes>
      <Route element={<RequireRole min={Role.Admin} />}>
        <Route path="/x" element={<div>protected</div>} />
      </Route>
    </Routes>,
    { route: '/x' },
  );
}

afterEach(() => useAuthStore.getState().clear());

describe('RequireRole (route guard)', () => {
  it('renders the protected route when the role meets the floor', () => {
    renderAt(Role.Admin);
    expect(screen.getByText('protected')).toBeInTheDocument();
  });

  it('renders the 403 Forbidden page when the role is below the floor', () => {
    renderAt(Role.Moderator);
    expect(screen.getByText(/access to this/i)).toBeInTheDocument();
    expect(screen.queryByText('protected')).not.toBeInTheDocument();
  });
});
