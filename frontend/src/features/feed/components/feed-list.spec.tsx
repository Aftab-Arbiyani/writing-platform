import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';

import type { useFeed } from '../hooks/use-feed';
import type { FeedItem } from '../types/feed.types';
import { FeedList } from './feed-list';

type FeedQuery = ReturnType<typeof useFeed>;

function makeQuery(over: Partial<FeedQuery> = {}): FeedQuery {
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
  } as unknown as FeedQuery;
}

function makeItem(id: string): FeedItem {
  return {
    id,
    slug: `slug-${id}`,
    title: `Piece ${id}`,
    subtitle: null,
    featuredQuote: null,
    coverImageKey: null,
    language: { code: 'ur', direction: 'rtl', nativeName: 'اردو' },
    genre: { slug: 'ghazal', name: 'Ghazal' },
    author: { username: `writer${id}`, penName: `Writer ${id}`, avatarKey: null },
    stats: { likes: 0, claps: 10, comments: 2, responses: 0 },
    visibility: 'public',
    wordCount: 200,
    readingTimeSeconds: 120,
    publishedAt: '2026-07-01T00:00:00.000Z',
  };
}

const noop = { onClearFilters: vi.fn(), onGoDiscover: vi.fn() };

describe('FeedList', () => {
  it('shows the skeleton while the first page loads', () => {
    renderWithProviders(
      <FeedList
        query={makeQuery({ isLoading: true })}
        tab="latest"
        locked={false}
        hasActiveFilters={false}
        {...noop}
      />,
    );
    expect(screen.getByLabelText('Loading feed')).toBeInTheDocument();
  });

  it('shows an in-place error panel with requestId and retries', () => {
    const query = makeQuery({
      isError: true,
      error: new ApiError(500, {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'boom',
        requestId: 'req-9',
      }),
    });
    renderWithProviders(
      <FeedList query={query} tab="latest" locked={false} hasActiveFilters={false} {...noop} />,
    );
    expect(screen.getByText("Couldn't load the feed.")).toBeInTheDocument();
    expect(screen.getByText('Ref: req-9')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(query.refetch).toHaveBeenCalledTimes(1);
  });

  it('renders the following empty state with a discover action', () => {
    const onGoDiscover = vi.fn();
    const query = makeQuery({
      data: {
        pages: [{ items: [], meta: { nextCursor: null, hasMore: false } }],
        pageParams: [undefined],
      } as unknown as FeedQuery['data'],
    });
    renderWithProviders(
      <FeedList
        query={query}
        tab="following"
        locked={false}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
        onGoDiscover={onGoDiscover}
      />,
    );
    expect(screen.getByText('Your feed is a blank page.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discover writers' }));
    expect(onGoDiscover).toHaveBeenCalled();
  });

  it('renders a filter-specific empty state that clears filters', () => {
    const onClearFilters = vi.fn();
    const query = makeQuery({
      data: {
        pages: [{ items: [], meta: { nextCursor: null, hasMore: false } }],
        pageParams: [undefined],
      } as unknown as FeedQuery['data'],
    });
    renderWithProviders(
      <FeedList
        query={query}
        tab="latest"
        locked={false}
        hasActiveFilters
        onClearFilters={onClearFilters}
        onGoDiscover={vi.fn()}
      />,
    );
    expect(screen.getByText('No pieces match these filters.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('prompts sign-in when the following tab is viewed signed out', () => {
    renderWithProviders(
      <FeedList query={makeQuery()} tab="following" locked hasActiveFilters={false} {...noop} />,
    );
    expect(screen.getByText('Sign in to see your feed.')).toBeInTheDocument();
  });

  it('renders cards and the end-cap when the feed is exhausted', () => {
    const query = makeQuery({
      hasNextPage: false,
      data: {
        pages: [
          { items: [makeItem('1'), makeItem('2')], meta: { nextCursor: null, hasMore: false } },
        ],
        pageParams: [undefined],
      } as unknown as FeedQuery['data'],
    });
    renderWithProviders(
      <FeedList query={query} tab="latest" locked={false} hasActiveFilters={false} {...noop} />,
    );
    expect(screen.getByRole('link', { name: 'Piece 1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Piece 2' })).toBeInTheDocument();
    expect(screen.getByText(/You've read it all\. The rest is unwritten/)).toBeInTheDocument();
  });
});
