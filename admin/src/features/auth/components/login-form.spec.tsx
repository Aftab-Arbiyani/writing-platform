import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

vi.mock('../api/auth.api', () => ({
  authApi: { login: vi.fn(), refresh: vi.fn(), logout: vi.fn() },
}));

import { authApi } from '../api/auth.api';
import { LoginForm } from './login-form';

function makeToken(role: string): string {
  const b64 = (obj: object): string =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `x.${b64({ sub: 'u1', role, sv: 1, exp: 9999999999 })}.sig`;
}

beforeEach(() => {
  useAuthStore.setState({ status: 'unknown', role: null, sessionExpired: false });
  vi.clearAllMocks();
});

describe('LoginForm', () => {
  it('renders labelled email + password fields', () => {
    renderWithProviders(<LoginForm onSuccess={vi.fn()} />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows validation errors on empty submit and does not call the API', async () => {
    renderWithProviders(<LoginForm onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('logs in and calls onSuccess with valid credentials', async () => {
    (authApi.login as Mock).mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', username: 'ali', isEmailVerified: true },
      accessToken: makeToken('admin'),
    });
    const onSuccess = vi.fn();
    renderWithProviders(<LoginForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(authApi.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret' });
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('surfaces a mapped error message when credentials are rejected', async () => {
    (authApi.login as Mock).mockRejectedValue(
      new ApiError(401, { code: 'AUTH_INVALID_CREDENTIALS', message: 'bad' }),
    );
    renderWithProviders(<LoginForm onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText(/incorrect/i)).toBeInTheDocument();
  });

  it('toggles password visibility', () => {
    renderWithProviders(<LoginForm onSuccess={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: 'Show password' });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });
});
