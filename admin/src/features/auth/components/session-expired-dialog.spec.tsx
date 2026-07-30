import { Role } from '@qalam/shared';
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import { SessionExpiredDialog } from './session-expired-dialog';

afterEach(() => useAuthStore.getState().clear());

describe('SessionExpiredDialog', () => {
  it('appears when the session has expired', () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Admin, sessionExpired: true });
    renderWithProviders(<SessionExpiredDialog />);
    expect(screen.getByText('Your session has expired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeInTheDocument();
  });

  it('renders nothing while the session is valid', () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Admin, sessionExpired: false });
    renderWithProviders(<SessionExpiredDialog />);
    expect(screen.queryByText('Your session has expired')).not.toBeInTheDocument();
  });
});
