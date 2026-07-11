import { Role, UserStatus } from '@qalam/shared';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import type { AdminUserListItem } from '../types/users.types';
import { ConfirmActionDialog } from './confirm-action-dialog';

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('../hooks/use-user-mutations', () => ({
  useUserAction: () => ({ mutate, isPending: false }),
}));

const user: AdminUserListItem = {
  id: 'u1',
  avatarKey: null,
  username: 'meera',
  displayName: 'Meera',
  email: 'meera@example.com',
  role: Role.User,
  status: UserStatus.Active,
  verified: false,
  isPrivate: false,
  followers: 0,
  following: 0,
  publishedPieces: 0,
  draftCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: null,
  lastActiveAt: null,
  deletedAt: null,
};

afterEach(() => vi.clearAllMocks());

describe('ConfirmActionDialog', () => {
  it('renders no dialog when there is no pending action', () => {
    renderWithProviders(<ConfirmActionDialog pending={null} onClose={vi.fn()} />);
    expect(
      screen.queryByText('All active sessions are revoked immediately.'),
    ).not.toBeInTheDocument();
  });

  it('shows consequences and runs the action with the reason on confirm', () => {
    renderWithProviders(
      <ConfirmActionDialog pending={{ user, action: 'suspend' }} onClose={vi.fn()} />,
    );

    expect(screen.getByText('All active sessions are revoked immediately.')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'spam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    expect(mutate).toHaveBeenCalledWith(
      { id: 'u1', action: 'suspend', reason: 'spam' },
      expect.anything(),
    );
  });
});
