import { Role, TrustLevel, TrustStatus, UserStatus } from '@qalam/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import { useUser, useUserActivity, useUserAudit, useUserLoginHistory } from '../hooks/use-user';
import type { AdminUserDetail, AdminUserListItem } from '../types/users.types';
import { UserDetailDrawer } from './user-detail-drawer';

vi.mock('../hooks/use-user');
vi.mock('../api/trust.api');

const { trustApi } = await import('../api/trust.api');

const USER_ID = '44444444-4444-4444-8444-444444444444';

const row: AdminUserListItem = {
  id: USER_ID,
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
};

const detail: AdminUserDetail = {
  id: USER_ID,
  username: 'meera',
  email: 'meera@example.com',
  role: Role.User,
  status: UserStatus.Active,
  verified: true,
  isPrivate: false,
  profile: {
    penName: null,
    bio: null,
    avatarKey: null,
    coverKey: null,
    websiteUrl: null,
    location: null,
    socialLinks: {},
  },
  statistics: {
    views: 0,
    reads: 0,
    followers: 0,
    following: 0,
    publishedPieces: 0,
    drafts: 0,
    comments: 0,
    bookmarks: 0,
    claps: 0,
    responses: 0,
  },
  moderation: {
    currentStatus: UserStatus.Active,
    isVerified: true,
    reports: 0,
    warnings: 0,
    statusChanges: 0,
    lastActionAt: null,
  },
  auditSummary: { totalEvents: 0, byAction: {}, byCategory: {}, lastActionAt: null },
  recentActivity: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: null,
  deletedAt: null,
};

function idle(): unknown {
  return { isLoading: false, isError: false, data: undefined, error: null, refetch: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useUser).mockReturnValue({
    isLoading: false,
    isError: false,
    data: detail,
  } as ReturnType<typeof useUser>);
  vi.mocked(useUserActivity).mockReturnValue(idle() as ReturnType<typeof useUserActivity>);
  vi.mocked(useUserAudit).mockReturnValue(idle() as ReturnType<typeof useUserAudit>);
  vi.mocked(useUserLoginHistory).mockReturnValue(idle() as ReturnType<typeof useUserLoginHistory>);
  vi.mocked(trustApi.summary).mockResolvedValue({
    score: 55,
    level: TrustLevel.Member,
    status: TrustStatus.Normal,
    activeStrikeWeight: 0,
    restrictions: [],
  });
  vi.mocked(trustApi.restrictions).mockResolvedValue([]);
});
afterEach(() => useAuthStore.getState().clear());

/**
 * The Trust tab's placement and its `trust.view` gate.
 *
 * The gate is exercised with `Role.User`, a role the admin router would never let into this screen
 * at all — because there is **no seeded role that reaches the drawer without `trust.view`**
 * (`Role.Moderator` upward all hold `trust.*`). A synthetic role is the only way to prove the branch
 * exists, and it is worth proving: `role_permissions` is editable at runtime, so the grant can move.
 */
describe('UserDetailDrawer — the Trust tab', () => {
  it('offers a Trust tab to a viewer who holds `trust.view`', () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Admin });

    renderWithProviders(<UserDetailDrawer user={row} onClose={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'Trust' })).toBeInTheDocument();
  });

  it('renders the panel for the drawer’s own user id when the tab is opened', async () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Admin });

    renderWithProviders(<UserDetailDrawer user={row} onClose={vi.fn()} onEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Trust' }));

    await waitFor(() => expect(trustApi.summary).toHaveBeenCalledWith(USER_ID, expect.anything()));
    expect(trustApi.restrictions).toHaveBeenCalledWith(USER_ID, expect.anything());
    expect(screen.getByTestId('trust-panel')).toBeInTheDocument();
  });

  it('shows NO Trust tab to a viewer without `trust.view`, rather than one that would 403', () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.User });

    renderWithProviders(<UserDetailDrawer user={row} onClose={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.queryByRole('tab', { name: 'Trust' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
  });

  it('fires no trust request while another tab is selected', () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Admin });

    renderWithProviders(<UserDetailDrawer user={row} onClose={vi.fn()} onEdit={vi.fn()} />);

    expect(trustApi.summary).not.toHaveBeenCalled();
  });
});
