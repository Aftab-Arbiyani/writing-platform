import { Role, UserStatus } from '@qalam/shared';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import type { AdminUserListItem } from '../types/users.types';
import { UserRowActions } from './user-row-actions';

function user(overrides: Partial<AdminUserListItem> = {}): AdminUserListItem {
  return {
    id: 'u1',
    avatarKey: null,
    username: 'meera',
    displayName: 'Meera',
    email: 'meera@example.com',
    role: Role.User,
    status: UserStatus.Active,
    verified: true,
    isPrivate: false,
    followers: 0,
    following: 0,
    publishedPieces: 0,
    draftCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: null,
    lastActiveAt: null,
    deletedAt: null,
    ...overrides,
  };
}

async function openMenu(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: /actions for meera/i }));
  await screen.findByRole('menu');
}

describe('UserRowActions', () => {
  beforeEach(() => useAuthStore.setState({ status: 'authenticated', role: Role.SuperAdmin }));
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.clearAllMocks();
  });

  it('offers Suspend (not Lift suspension) for an active account', async () => {
    renderWithProviders(
      <UserRowActions
        user={user()}
        isSelf={false}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    await openMenu();
    expect(screen.getByText('Suspend')).toBeInTheDocument();
    expect(screen.getByText('Deactivate')).toBeInTheDocument();
    expect(screen.queryByText('Lift suspension')).not.toBeInTheDocument();
  });

  it('offers Lift suspension (not Suspend) for a suspended account', async () => {
    renderWithProviders(
      <UserRowActions
        user={user({ status: UserStatus.Suspended })}
        isSelf={false}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    await openMenu();
    expect(screen.getByText('Lift suspension')).toBeInTheDocument();
    expect(screen.queryByText('Suspend')).not.toBeInTheDocument();
  });

  it('hides Verify for an already-verified user', async () => {
    renderWithProviders(
      <UserRowActions
        user={user({ verified: true })}
        isSelf={false}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    await openMenu();
    expect(screen.queryByText('Verify user')).not.toBeInTheDocument();
  });

  it('fires the action callback when an item is chosen', async () => {
    const onAction = vi.fn();
    renderWithProviders(
      <UserRowActions
        user={user()}
        isSelf={false}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onAction={onAction}
      />,
    );
    await openMenu();
    fireEvent.click(screen.getByText('Suspend'));
    expect(onAction).toHaveBeenCalledWith('suspend');
  });

  it('shows only View profile for a role without user permissions', async () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Moderator });
    renderWithProviders(
      <UserRowActions
        user={user()}
        isSelf={false}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    await openMenu();
    expect(screen.getByText('View profile')).toBeInTheDocument();
    expect(screen.queryByText('Suspend')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit user')).not.toBeInTheDocument();
  });
});
