import { PieceStatus, Visibility } from '@qalam/shared';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { useMyPieces } from '../hooks/use-my-pieces';
import { usePieceLimit } from '../hooks/use-piece-limit';
import type { PieceLimit, PieceListItem } from '../types/piece.types';
import { DashboardPage } from './dashboard-page';

vi.mock('../hooks/use-my-pieces', () => ({ useMyPieces: vi.fn() }));
vi.mock('../hooks/use-piece-limit', () => ({ usePieceLimit: vi.fn() }));

/** B4: the allowance the server reports. Unlimited by default, so existing cases are unaffected. */
function allowance(over: Partial<PieceLimit> = {}): void {
  vi.mocked(usePieceLimit).mockReturnValue({
    data: { used: 3, limit: 0, remaining: null, unlimited: true, canCreate: true, ...over },
  } as unknown as ReturnType<typeof usePieceLimit>);
}

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
    allowance();
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

  // ── B4 — the plan piece cap (docs/45 §4.9). These assert REACHABILITY: that the count is on
  //    the page before it bites, and that the create control is actually off when the server
  //    says the author cannot create. The repeated defect here is a surface that looks wired.
  describe('plan piece limit', () => {
    it('shows the count beside the create action, before the cap bites', () => {
      allowance({ used: 24, limit: 25, remaining: 1, unlimited: false, canCreate: true });
      vi.mocked(useMyPieces).mockReturnValue(fakeQuery({ data: pageData([item()]) }));
      renderWithProviders(<DashboardPage />, { route: '/me/drafts' });
      expect(screen.getByText('24 of 25 pieces')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'New draft' })).toBeEnabled();
    });

    it('shows no count on an unlimited plan', () => {
      vi.mocked(useMyPieces).mockReturnValue(fakeQuery({ data: pageData([item()]) }));
      renderWithProviders(<DashboardPage />, { route: '/me/drafts' });
      expect(screen.queryByText(/of \d+ pieces/)).not.toBeInTheDocument();
    });

    it('disables the create action and explains why once the cap is full', () => {
      allowance({ used: 25, limit: 25, remaining: 0, unlimited: false, canCreate: false });
      vi.mocked(useMyPieces).mockReturnValue(fakeQuery({ data: pageData([item()]) }));
      renderWithProviders(<DashboardPage />, { route: '/me/drafts' });

      const create = screen.getByRole('button', { name: 'New draft' });
      expect(create).toBeDisabled();
      expect(screen.getByText('You’ve used all 25 pieces on your plan.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'See plans' })).toBeInTheDocument();
      // The disabled control is not silent: it points at the explanation next to it.
      expect(create).toHaveAttribute('aria-describedby', 'piece-limit-notice');
    });

    it('states the honest over-limit case a downgrade produces, and keeps the work visible', () => {
      allowance({ used: 100, limit: 25, remaining: 0, unlimited: false, canCreate: false });
      vi.mocked(useMyPieces).mockReturnValue(fakeQuery({ data: pageData([item()]) }));
      renderWithProviders(<DashboardPage />, { route: '/me/drafts' });

      expect(
        screen.getByText('You have 100 pieces and your plan includes 25.'),
      ).toBeInTheDocument();
      // "Keep everything" has to be legible on the page, not only in the backend's behaviour.
      expect(screen.getByText(/stays exactly where it is/)).toBeInTheDocument();
      expect(screen.getByText('My first draft')).toBeInTheDocument();
    });

    it('never offers a reset — the remedies are delete or upgrade, never waiting', () => {
      allowance({ used: 25, limit: 25, remaining: 0, unlimited: false, canCreate: false });
      vi.mocked(useMyPieces).mockReturnValue(fakeQuery({ data: pageData([item()]) }));
      renderWithProviders(<DashboardPage />, { route: '/me/drafts' });
      expect(screen.queryByText(/reset/i)).not.toBeInTheDocument();
      expect(screen.getByText(/delete a piece to free a slot/)).toBeInTheDocument();
    });

    it('disables the empty-state action too — reachable when a downgrade leaves no drafts', () => {
      allowance({ used: 100, limit: 25, remaining: 0, unlimited: false, canCreate: false });
      vi.mocked(useMyPieces).mockReturnValue(fakeQuery({ data: pageData([]) }));
      renderWithProviders(<DashboardPage />, { route: '/me/drafts' });
      expect(screen.getByRole('button', { name: 'Write your first draft' })).toBeDisabled();
    });

    it('stays usable while the allowance read is still in flight', () => {
      vi.mocked(usePieceLimit).mockReturnValue({ data: undefined } as unknown as ReturnType<
        typeof usePieceLimit
      >);
      vi.mocked(useMyPieces).mockReturnValue(fakeQuery({ data: pageData([item()]) }));
      renderWithProviders(<DashboardPage />, { route: '/me/drafts' });
      expect(screen.getByRole('button', { name: 'New draft' })).toBeEnabled();
    });
  });
});
