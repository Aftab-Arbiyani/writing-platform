import { FollowStatus } from '@qalam/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { qk } from '@/lib/query-keys';
import type { ProfileResponse } from '@/types/profile';

import { followsApi } from '../api/follows.api';
import { useFollow } from './use-follow';

vi.mock('../api/follows.api', () => ({
  followsApi: { follow: vi.fn(), unfollow: vi.fn() },
}));

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

function setup(seed: ProfileResponse) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(qk.profiles.detail('meera'), seed);
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useFollow('meera'), { wrapper });
  const read = () => client.getQueryData<ProfileResponse>(qk.profiles.detail('meera'));
  return { result, read };
}

describe('useFollow (optimistic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('optimistically follows a public writer (+1 follower, isFollowing)', async () => {
    vi.mocked(followsApi.follow).mockResolvedValue({ status: FollowStatus.Accepted });
    const { result, read } = setup(profile());

    await act(async () => {
      result.current.follow.mutate('u1');
    });

    await waitFor(() => {
      expect(read()?.viewerRelation.isFollowing).toBe(true);
    });
    expect(read()?.counts.followers).toBe(2);
    expect(followsApi.follow).toHaveBeenCalledWith('u1');
  });

  it('sends a pending request for a private writer (no follower bump)', async () => {
    vi.mocked(followsApi.follow).mockResolvedValue({ status: FollowStatus.Pending });
    const { result, read } = setup(profile({ isPrivate: true }));

    await act(async () => {
      result.current.follow.mutate('u1');
    });

    await waitFor(() => {
      expect(read()?.viewerRelation.hasPendingRequest).toBe(true);
    });
    expect(read()?.viewerRelation.isFollowing).toBe(false);
    expect(read()?.counts.followers).toBe(1);
  });

  it('rolls back when the follow fails', async () => {
    vi.mocked(followsApi.follow).mockRejectedValue(new Error('nope'));
    const { result, read } = setup(profile());

    await act(async () => {
      result.current.follow.mutate('u1');
    });

    await waitFor(() => {
      expect(result.current.follow.isError).toBe(true);
    });
    expect(read()?.viewerRelation.isFollowing).toBe(false);
    expect(read()?.counts.followers).toBe(1);
  });

  it('unfollows an accepted follow (−1 follower)', async () => {
    vi.mocked(followsApi.unfollow).mockResolvedValue(undefined);
    const { result, read } = setup(
      profile({
        viewerRelation: { isSelf: false, isFollowing: true, hasPendingRequest: false },
        counts: { ...profile().counts, followers: 5 },
      }),
    );

    await act(async () => {
      result.current.unfollow.mutate('u1');
    });

    await waitFor(() => {
      expect(read()?.viewerRelation.isFollowing).toBe(false);
    });
    expect(read()?.counts.followers).toBe(4);
  });
});
