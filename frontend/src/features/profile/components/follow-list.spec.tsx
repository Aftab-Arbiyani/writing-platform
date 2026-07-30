import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import type { UserSummary } from '@/types/profile';

import type { useFollowers } from '../hooks/use-follow-lists';
import { FollowList } from './follow-list';

type Query = ReturnType<typeof useFollowers>;

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

function pageData(items: UserSummary[]): Query['data'] {
  return {
    pages: [{ items, meta: { nextCursor: null, hasMore: false } }],
    pageParams: [undefined],
  } as unknown as Query['data'];
}

const props = { emptyTitle: 'No followers yet.', emptyDescription: 'They will appear here.' };

describe('FollowList', () => {
  it('shows the empty state', () => {
    renderWithProviders(<FollowList query={fakeQuery({ data: pageData([]) })} {...props} />);
    expect(screen.getByText('No followers yet.')).toBeInTheDocument();
  });

  it('renders a writer row with pen name and @username', () => {
    const users: UserSummary[] = [
      { id: 'u1', username: 'meera_k', penName: 'Meera K', avatarKey: null },
    ];
    renderWithProviders(<FollowList query={fakeQuery({ data: pageData(users) })} {...props} />);
    expect(screen.getByText('Meera K')).toBeInTheDocument();
    expect(screen.getByText('@meera_k')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/@meera_k');
  });

  it('renders the error state with retry', () => {
    renderWithProviders(
      <FollowList query={fakeQuery({ isError: true, error: new Error('x') })} {...props} />,
    );
    expect(screen.getByText('Couldn’t load this list.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
