import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import type { FollowRequest } from '@/types/profile';

import type * as UseFollowRequestsModule from '../hooks/use-follow-requests';
import { useFollowRequests } from '../hooks/use-follow-requests';
import { FollowRequestsPage } from './follow-requests-page';

vi.mock('../hooks/use-follow-requests', async () => {
  const actual = await vi.importActual<typeof UseFollowRequestsModule>(
    '../hooks/use-follow-requests',
  );
  return { ...actual, useFollowRequests: vi.fn() };
});

type Query = ReturnType<typeof useFollowRequests>;

function fakeQuery(over: Partial<Query> = {}): Query {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...over,
  } as unknown as Query;
}

function pageData(items: FollowRequest[]): Query['data'] {
  return {
    pages: [{ items, meta: { nextCursor: null, hasMore: false } }],
    pageParams: [undefined],
  } as unknown as Query['data'];
}

describe('FollowRequestsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state', () => {
    vi.mocked(useFollowRequests).mockReturnValue(fakeQuery({ data: pageData([]) }));
    renderWithProviders(<FollowRequestsPage />, { route: '/me/follow-requests' });
    expect(screen.getByText('No follow requests.')).toBeInTheDocument();
  });

  it('lists a request with accept + decline actions', () => {
    const requests: FollowRequest[] = [
      {
        id: 'f1',
        requester: { id: 'u2', username: 'omar', penName: 'Omar', avatarKey: null },
        requestedAt: '2026-07-08T00:00:00.000Z',
      },
    ];
    vi.mocked(useFollowRequests).mockReturnValue(fakeQuery({ data: pageData(requests) }));
    renderWithProviders(<FollowRequestsPage />, { route: '/me/follow-requests' });
    expect(screen.getByText('Omar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept request from Omar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline request from Omar' })).toBeInTheDocument();
  });
});
