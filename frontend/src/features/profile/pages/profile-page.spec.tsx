import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import type { ProfileResponse } from '@/types/profile';

import { useMyProfilePieces } from '../hooks/use-profile-pieces';
import { useProfile } from '../hooks/use-profile';
import { ProfilePage } from './profile-page';

vi.mock('../hooks/use-profile', () => ({ useProfile: vi.fn() }));
vi.mock('../hooks/use-profile-pieces', () => ({ useMyProfilePieces: vi.fn() }));

type ProfileQuery = ReturnType<typeof useProfile>;

function profileQuery(over: Partial<ProfileQuery> = {}): ProfileQuery {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...over,
  } as unknown as ProfileQuery;
}

function piecesQuery(): ReturnType<typeof useMyProfilePieces> {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useMyProfilePieces>;
}

function profile(over: Partial<ProfileResponse> = {}): ProfileResponse {
  return {
    id: 'u1',
    username: 'meera',
    penName: 'Meera',
    avatarKey: null,
    coverKey: null,
    bio: 'Poet of the monsoon.',
    isPrivate: false,
    counts: {
      followers: 12,
      following: 3,
      piecesPublished: 4,
      totalReads: 0,
      totalLikes: 0,
      totalClaps: 0,
      bookmarksReceived: 0,
      responseCount: 0,
    },
    viewerRelation: { isSelf: false, isFollowing: false, hasPendingRequest: false },
    restricted: false,
    ...over,
  };
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMyProfilePieces).mockReturnValue(piecesQuery());
  });

  it('shows a loading state', () => {
    vi.mocked(useProfile).mockReturnValue(profileQuery({ isLoading: true }));
    renderWithProviders(<ProfilePage username="meera" />, { route: '/@meera' });
    expect(screen.getByRole('status', { name: 'Loading profile' })).toBeInTheDocument();
  });

  it('shows a not-found state on 404 without leaking existence', () => {
    vi.mocked(useProfile).mockReturnValue(
      profileQuery({
        isError: true,
        error: new ApiError(404, { code: 'USER_NOT_FOUND', message: 'x' }),
      }),
    );
    renderWithProviders(<ProfilePage username="ghost" />, { route: '/@ghost' });
    expect(screen.getByText('We couldn’t find that writer.')).toBeInTheDocument();
  });

  it('renders a private teaser with the lock copy and no tabs', () => {
    vi.mocked(useProfile).mockReturnValue(
      profileQuery({ data: profile({ isPrivate: true, restricted: true, bio: undefined }) }),
    );
    renderWithProviders(<ProfilePage username="meera" />, { route: '/@meera' });
    expect(screen.getByText('This writer keeps a private notebook.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'About' })).not.toBeInTheDocument();
  });

  it('renders another writer with pen name, username, tabs, and a Follow button', () => {
    vi.mocked(useProfile).mockReturnValue(profileQuery({ data: profile() }));
    renderWithProviders(<ProfilePage username="meera" />, { route: '/@meera' });
    expect(screen.getByRole('heading', { name: 'Meera' })).toBeInTheDocument();
    expect(screen.getByText('@meera')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
  });

  it('shows Edit profile (not Follow) on the viewer’s own profile', () => {
    vi.mocked(useProfile).mockReturnValue(
      profileQuery({
        data: profile({
          viewerRelation: { isSelf: true, isFollowing: false, hasPendingRequest: false },
        }),
      }),
    );
    renderWithProviders(<ProfilePage username="meera" />, { route: '/@meera' });
    expect(screen.getByRole('link', { name: 'Edit profile' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Follow' })).not.toBeInTheDocument();
  });
});
