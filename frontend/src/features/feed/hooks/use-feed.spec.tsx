import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CursorPage } from '@/lib/api-client';

import { feedApi } from '../api/feed.api';
import type { FeedItem } from '../types/feed.types';
import { useFeed } from './use-feed';

vi.mock('../api/feed.api', () => ({ feedApi: { list: vi.fn() } }));

function providers() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const item = (id: string): FeedItem => ({ id }) as FeedItem;
const page1: CursorPage<FeedItem> = {
  items: [item('1'), item('2')],
  meta: { nextCursor: 'cursor-2', hasMore: true },
};
const page2: CursorPage<FeedItem> = {
  items: [item('3')],
  meta: { nextCursor: null, hasMore: false },
};

describe('useFeed', () => {
  beforeEach(() => {
    vi.mocked(feedApi.list).mockReset();
    // Deterministic by cursor — robust to call count/order (no fragile once-queue).
    vi.mocked(feedApi.list).mockImplementation((_tab, { cursor } = {}) =>
      Promise.resolve(cursor === 'cursor-2' ? page2 : page1),
    );
  });

  it('loads the first page (cursor undefined) and reports more pages', async () => {
    const { result } = renderHook(() => useFeed('latest', {}), { wrapper: providers() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.pages[0]?.items).toHaveLength(2);
    expect(result.current.hasNextPage).toBe(true);
    expect(feedApi.list).toHaveBeenCalledWith(
      'latest',
      expect.objectContaining({ cursor: undefined }),
    );
  });

  it('paginates via the nextCursor and stops at the end', async () => {
    const { result } = renderHook(() => useFeed('latest', {}), { wrapper: providers() });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(2);
    });
    expect(result.current.hasNextPage).toBe(false);
    expect(feedApi.list).toHaveBeenLastCalledWith(
      'latest',
      expect.objectContaining({ cursor: 'cursor-2' }),
    );
  });

  it('does not fetch while disabled (following tab, signed out)', () => {
    renderHook(() => useFeed('following', {}, false), { wrapper: providers() });
    expect(feedApi.list).not.toHaveBeenCalled();
  });
});
