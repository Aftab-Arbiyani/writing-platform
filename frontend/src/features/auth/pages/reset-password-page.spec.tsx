import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authApi } from '@/features/auth/api/auth.api';
import { renderWithProviders } from '@/test/render';

import { ResetPasswordPage } from './reset-password-page';

vi.mock('@/features/auth/api/auth.api', () => ({
  authApi: { resetPassword: vi.fn() },
}));

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the expired-link dead-end when no token is present', () => {
    renderWithProviders(<ResetPasswordPage />, { route: '/auth/reset-password' });
    expect(screen.getByText('This link has expired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request a new link' })).toBeInTheDocument();
  });

  it('updates the password with the URL token and shows the success screen', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue({ reset: true });
    renderWithProviders(<ResetPasswordPage />, { route: '/auth/reset-password?token=abc123' });

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'a-strong-passphrase' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'a-strong-passphrase' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Password updated')).toBeInTheDocument();
    expect(authApi.resetPassword).toHaveBeenCalledWith({
      token: 'abc123',
      newPassword: 'a-strong-passphrase',
    });
  });
});
