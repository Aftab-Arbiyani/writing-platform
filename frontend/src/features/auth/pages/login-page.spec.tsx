import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authApi } from '@/features/auth/api/auth.api';
import { ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import { LoginPage } from './login-page';

// vitest hoists vi.mock above the imports, so `authApi` above is the mocked module.
vi.mock('@/features/auth/api/auth.api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
    googleExchange: vi.fn(),
  },
}));

function token(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64url({ typ: 'JWT' })}.${b64url(payload)}.sig`;
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clear();
  });

  it('validates required fields before hitting the API', async () => {
    renderWithProviders(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('signs in and establishes the session on success', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      user: { id: '1', email: 'meera@example.com', username: 'meera_k', isEmailVerified: true },
      accessToken: token({ sub: '1', role: 'user' }),
    });
    renderWithProviders(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'meera@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-passphrase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: 'meera@example.com',
        password: 'secret-passphrase',
      });
    });
    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('authenticated');
    });
  });

  it('shows a form-level banner on invalid credentials', async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiError(401, { code: 'AUTH_INVALID_CREDENTIALS', message: 'dev' }),
    );
    renderWithProviders(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'meera@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText("That email and password don't match.")).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });
});
