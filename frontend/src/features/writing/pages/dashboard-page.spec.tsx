import { PieceStatus, Visibility } from '@qalam/shared';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { useMyPieces } from '../hooks/use-my-pieces';
import type { PieceListItem } from '../types/piece.types';
import { DashboardPage } from './dashboard-page';

vi.mock('../hooks/use-my-pieces', () => ({ useMyPieces: vi.fn() }));

type PiecesQuery = ReturnType<typeof useMyPieces>;

function fakeQuery(over: Partial<PiecesQuery> = {}): PiecesQuery {
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
  } as unknown as PiecesQuery;
}

function item(over: Partial<PieceListItem> = {}): PieceListItem {
  return {
    id: 'p1',
    title: 'My first draft',
    slug: null,
    status: PieceStatus.Draft,
    visibility: Visibility.Public,
    coverImageKey: null,
    wordCount: 120,
    readingTimeSeconds: 60,
    publishedAt: null,
    scheduledAt: null,
    updatedAt: '2026-07-08T00:00:00.000Z',
    ...over,
  };
}

function pageData(items: PieceListItem[]): PiecesQuery['data'] {
  return {
    pages: [{ items, meta: { nextCursor: null, hasMore: false } }],
    pageParams: [undefined],
  } as unknown as PiecesQuery['data'];
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the drafts empty state with a first-draft action', () => {
    vi.mocked(useMyPieces).mockReturnValue(fakeQuery({ data: pageData([]) }));
    renderWithProviders(<DashboardPage />, { route: '/me/drafts' });
    expect(
      screen.getByText('Nothing here yet — that’s how every book starts.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Write your first draft' })).toBeInTheDocument();
  });

  it('lists the author’s pieces with status and a Continue writing shortcut', () => {
    vi.mocked(useMyPieces).mockReturnValue(fakeQuery({ data: pageData([item()]) }));
    renderWithProviders(<DashboardPage />, { route: '/me/drafts' });
    expect(screen.getByText('My first draft')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue writing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New draft' })).toBeInTheDocument();
  });

  it('renders the error state with retry', () => {
    vi.mocked(useMyPieces).mockReturnValue(fakeQuery({ isError: true, error: new Error('boom') }));
    renderWithProviders(<DashboardPage />, { route: '/me/drafts' });
    expect(screen.getByText('Couldn’t load your pieces.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
