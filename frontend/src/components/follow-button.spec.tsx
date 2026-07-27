import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';
import type { ProfileResponse } from '@/types/profile';

import { useFollow } from '@/hooks/use-follow';

import { FollowButton } from './follow-button';

vi.mock('@/hooks/use-follow', () => ({ useFollow: vi.fn() }));

const followMutate = vi.fn();
const unfollowMutate = vi.fn();

function mockFollow(): void {
  vi.mocked(useFollow).mockReturnValue({
    follow: { mutate: followMutate, isPending: false },
    unfollow: { mutate: unfollowMutate, isPending: false },
  } as unknown as ReturnType<typeof useFollow>);
}

function profile(over: Partial<ProfileResponse> = {}): ProfileResponse {
  return {
    id: 'u1',
    username: 'meera',
    penName: 'Meera',
    avatarKey: null,
    isPrivate: false,
    counts: {
      followers: 1,
      following: 0,
      piecesPublished: 0,
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

describe('FollowButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFollow();
    useAuthStore.setState({
      status: 'authenticated',
      role: null,
      isEmailVerified: null,
      sessionExpired: false,
    });
  });

  it('renders nothing for the viewer’s own profile', () => {
    renderWithProviders(
      <FollowButton
        profile={profile({
          viewerRelation: { isSelf: true, isFollowing: false, hasPendingRequest: false },
        })}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('follows a public writer with the target user id', () => {
    renderWithProviders(<FollowButton profile={profile()} />);
    const button = screen.getByRole('button', { name: 'Follow' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(followMutate).toHaveBeenCalledWith('u1', expect.anything());
  });

  it('labels a private target “Request to follow”', () => {
    renderWithProviders(<FollowButton profile={profile({ isPrivate: true, restricted: true })} />);
    expect(screen.getByRole('button', { name: 'Request to follow' })).toBeInTheDocument();
  });

  it('shows Following (pressed) and unfollows on click', () => {
    renderWithProviders(
      <FollowButton
        profile={profile({
          viewerRelation: { isSelf: false, isFollowing: true, hasPendingRequest: false },
        })}
      />,
    );
    const button = screen.getByRole('button', { name: 'Following' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(unfollowMutate).toHaveBeenCalledWith('u1', expect.anything());
  });

  it('shows Requested for a pending request', () => {
    renderWithProviders(
      <FollowButton
        profile={profile({
          isPrivate: true,
          viewerRelation: { isSelf: false, isFollowing: false, hasPendingRequest: true },
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Requested' })).toBeInTheDocument();
  });

  it('does not follow when signed out (routes to sign-in instead)', () => {
    useAuthStore.setState({
      status: 'anonymous',
      role: null,
      isEmailVerified: null,
      sessionExpired: false,
    });
    renderWithProviders(<FollowButton profile={profile()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    expect(followMutate).not.toHaveBeenCalled();
  });
});
