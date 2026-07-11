import { Role, UserStatus } from '@qalam/shared';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMe } from '@/hooks/use-me';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import { downloadUserExport } from '../api/users.api';
import { useUser } from '../hooks/use-user';
import { useBulkUserAction, useUserAction } from '../hooks/use-user-mutations';
import { useUsers } from '../hooks/use-users';
import type { AdminUserListItem } from '../types/users.types';
import { UsersPage } from './users-page';

vi.mock('../hooks/use-users');
vi.mock('../hooks/use-user');
vi.mock('../hooks/use-user-mutations');
vi.mock('@/hooks/use-me');
vi.mock('../api/users.api', () => ({
  downloadUserExport: vi.fn().mockResolvedValue(undefined),
  usersApi: {},
}));

const row: AdminUserListItem = {
  id: 'u1',
  avatarKey: null,
  username: 'meera',
  displayName: 'Meera',
  email: 'meera@example.com',
  role: Role.User,
  status: UserStatus.Active,
  verified: true,
  isPrivate: false,
  followers: 12,
  following: 3,
  publishedPieces: 5,
  draftCount: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-07-01T00:00:00.000Z',
  lastActiveAt: null,
  deletedAt: null,
};

function stubQuery(over: Record<string, unknown> = {}): unknown {
  return {
    data: { items: [row], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...over,
  };
}

describe('UsersPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated', role: Role.SuperAdmin });
    vi.mocked(useUsers).mockReturnValue(stubQuery() as ReturnType<typeof useUsers>);
    vi.mocked(useUser).mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
    } as ReturnType<typeof useUser>);
    const mutation = { mutate: vi.fn(), isPending: false };
    vi.mocked(useUserAction).mockReturnValue(
      mutation as unknown as ReturnType<typeof useUserAction>,
    );
    vi.mocked(useBulkUserAction).mockReturnValue(
      mutation as unknown as ReturnType<typeof useBulkUserAction>,
    );
    vi.mocked(useMe).mockReturnValue({
      data: { id: 'admin1', username: 'admin', penName: 'Admin', avatarKey: null },
    } as ReturnType<typeof useMe>);
  });
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.clearAllMocks();
  });

  it('renders the user row and the total count', () => {
    renderWithProviders(<UsersPage />, { route: '/users' });
    expect(screen.getByText('@meera')).toBeInTheDocument();
    expect(screen.getByText(/of 1/)).toBeInTheDocument();
  });

  it('reveals the advanced filters when toggled', () => {
    renderWithProviders(<UsersPage />, { route: '/users' });
    expect(screen.queryByText('Registered from')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    expect(screen.getByText('Registered from')).toBeInTheDocument();
  });

  it('shows the bulk bar once rows are selected', () => {
    renderWithProviders(<UsersPage />, { route: '/users' });
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0] as HTMLElement); // header select-all
    expect(screen.getByText(/1 user selected/i)).toBeInTheDocument();
  });

  it('triggers a CSV export', async () => {
    renderWithProviders(<UsersPage />, { route: '/users' });
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    fireEvent.click(await screen.findByText('Export CSV'));
    expect(downloadUserExport).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
      'csv',
    );
  });
});
