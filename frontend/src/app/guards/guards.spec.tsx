import { render, screen } from '@testing-library/react';
import { Role } from '@qalam/shared';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';

import { RequireAuth } from './require-auth';
import { RequireGuest } from './require-guest';

afterEach(() => {
  useAuthStore.getState().clear();
});

function renderRequireAuth(entry = '/protected') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/protected" element={<div>secret content</div>} />
        </Route>
        <Route path="/auth/login" element={<div>login screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderRequireGuest(entry = '/auth/login') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<RequireGuest />}>
          <Route path="/auth/login" element={<div>login form</div>} />
        </Route>
        <Route path="/feed" element={<div>feed screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth (protected routes)', () => {
  it('shows the session loader while the boot check is unresolved', () => {
    useAuthStore.setState({ status: 'unknown' });
    renderRequireAuth();
    expect(screen.getByRole('status', { name: /loading your session/i })).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('renders the protected outlet when authenticated', () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.User });
    renderRequireAuth();
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });

  it('redirects an anonymous visitor to the login screen', () => {
    useAuthStore.getState().setAnonymous();
    renderRequireAuth();
    expect(screen.getByText('login screen')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });
});

describe('RequireGuest (guest-only routes)', () => {
  it('renders the guest outlet when anonymous', () => {
    useAuthStore.getState().setAnonymous();
    renderRequireGuest();
    expect(screen.getByText('login form')).toBeInTheDocument();
  });

  it('bounces an authenticated user away from the auth corridor', () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.User });
    renderRequireGuest();
    expect(screen.getByText('feed screen')).toBeInTheDocument();
    expect(screen.queryByText('login form')).not.toBeInTheDocument();
  });
});
