import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authApi } from '@/features/auth/api/auth.api';
import { renderWithProviders } from '@/test/render';

import { ForgotPasswordPage } from './forgot-password-page';

vi.mock('@/features/auth/api/auth.api', () => ({
  authApi: { forgotPassword: vi.fn() },
}));

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the email and shows the (enumeration-safe) confirmation', async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue({ sent: true });
    renderWithProviders(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'meera@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
    expect(authApi.forgotPassword).toHaveBeenCalledWith({ email: 'meera@example.com' });
  });

  it('blocks submission on an invalid email', async () => {
    renderWithProviders(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(authApi.forgotPassword).not.toHaveBeenCalled();
  });
});
