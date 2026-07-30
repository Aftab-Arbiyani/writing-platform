import { ShareChannel } from '@qalam/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { qk } from '@/lib/query-keys';

import { readingApi } from '../api/reading.api';
import type { PieceEngagement } from '../types/reading.types';
import { useEngagementActions } from './use-engagement';

vi.mock('../api/reading.api', () => ({
  readingApi: {
    like: vi.fn(),
    unlike: vi.fn(),
    bookmark: vi.fn(),
    unbookmark: vi.fn(),
    share: vi.fn(),
  },
}));

const PIECE_ID = 'p1';

function engagement(over: Partial<PieceEngagement> = {}): PieceEngagement {
  return {
    stats: { likes: 10, claps: 4, bookmarks: 2, comments: 0, responses: 1, shares: 3 },
    viewer: { hasLiked: false, clapCount: 0, hasBookmarked: false },
    ...over,
  };
}

function setup(seed: PieceEngagement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(qk.pieces.engagement(PIECE_ID), seed);
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useEngagementActions(PIECE_ID), { wrapper });
  const read = () => client.getQueryData<PieceEngagement>(qk.pieces.engagement(PIECE_ID));
  return { result, read };
}

describe('useEngagementActions (optimistic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('likes optimistically and then adopts the server total', async () => {
    // The server knows about 41 likes; our optimistic guess was 11. The truth must win.
    vi.mocked(readingApi.like).mockResolvedValue({ liked: true, totalLikes: 41 });
    const { result, read } = setup(engagement());

    await act(async () => {
      result.current.like.mutate(undefined);
    });

    await waitFor(() => {
      expect(read()?.viewer.hasLiked).toBe(true);
    });
    expect(read()?.stats.likes).toBe(41);
  });

  it('rolls the like back when the write fails', async () => {
    vi.mocked(readingApi.like).mockRejectedValue(new Error('nope'));
    const { result, read } = setup(engagement());

    await act(async () => {
      result.current.like.mutate(undefined);
    });

    await waitFor(() => {
      expect(result.current.like.isError).toBe(true);
    });
    expect(read()?.viewer.hasLiked).toBe(false);
    expect(read()?.stats.likes).toBe(10);
  });

  it('unlikes optimistically (−1, never below zero)', async () => {
    vi.mocked(readingApi.unlike).mockResolvedValue(undefined);
    const { result, read } = setup(
      engagement({
        stats: { likes: 0, claps: 0, bookmarks: 0, comments: 0, responses: 0, shares: 0 },
        viewer: { hasLiked: true, clapCount: 0, hasBookmarked: false },
      }),
    );

    await act(async () => {
      result.current.unlike.mutate(undefined);
    });

    await waitFor(() => {
      expect(read()?.viewer.hasLiked).toBe(false);
    });
    expect(read()?.stats.likes).toBe(0);
  });

  it('bookmarks optimistically and rolls back on failure', async () => {
    vi.mocked(readingApi.bookmark).mockRejectedValue(new Error('nope'));
    const { result, read } = setup(engagement());

    await act(async () => {
      result.current.bookmark.mutate(undefined);
    });

    await waitFor(() => {
      expect(result.current.bookmark.isError).toBe(true);
    });
    expect(read()?.viewer.hasBookmarked).toBe(false);
    expect(read()?.stats.bookmarks).toBe(2);
  });

  it('records a share on the copy-link channel and bumps the count', async () => {
    vi.mocked(readingApi.share).mockResolvedValue(undefined);
    const { result, read } = setup(engagement());

    await act(async () => {
      result.current.share.mutate(ShareChannel.CopyLink);
    });

    await waitFor(() => {
      expect(read()?.stats.shares).toBe(4);
    });
    expect(readingApi.share).toHaveBeenCalledWith(PIECE_ID, ShareChannel.CopyLink);
  });
});
