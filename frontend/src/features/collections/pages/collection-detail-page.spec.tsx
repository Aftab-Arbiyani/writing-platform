import { Role, Visibility } from '@qalam/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { collectionsApi } from '@/lib/collections-api';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import type { Collection, CollectionPiece } from '@/types/collection';

import { CollectionDetailPage } from './collection-detail-page';

vi.mock('@/lib/collections-api');

const detail = vi.mocked(collectionsApi.detail);
const pieces = vi.mocked(collectionsApi.pieces);
const removePiece = vi.mocked(collectionsApi.removePiece);

const COLLECTION_ID = 'col-1';

function header(over: Partial<Collection> = {}): Collection {
  return {
    id: COLLECTION_ID,
    title: 'Poems to reread',
    slug: 'poems-to-reread',
    description: 'The ones that keep working.',
    coverImageKey: null,
    visibility: Visibility.Private,
    isDefault: false,
    piecesCount: 2,
    createdAt: new Date('2026-08-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-08-01T00:00:00Z').toISOString(),
    ...over,
  };
}

function piece(over: Partial<CollectionPiece> = {}): CollectionPiece {
  return {
    pieceId: 'piece-1',
    slug: 'a-door-never-opened',
    title: 'A door never opened',
    position: 1,
    note: null,
    addedAt: new Date('2026-08-09T00:00:00Z').toISOString(),
    ...over,
  };
}

function page(items: CollectionPiece[], nextCursor: string | null = null) {
  return { items, meta: { nextCursor, hasMore: nextCursor !== null } };
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/me/collections/:collectionId" element={<CollectionDetailPage />} />
    </Routes>,
    { route: `/me/collections/${COLLECTION_ID}` },
  );
}

describe('CollectionDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setSession({ accessToken: 'token', role: Role.User });
    detail.mockResolvedValue(header());
    pieces.mockResolvedValue(page([piece()]));
    removePiece.mockResolvedValue(undefined);
  });

  it('renders the header and its pieces, each linking to the reader', async () => {
    pieces.mockResolvedValue(page([piece({ note: 'For the last stanza.' })]));
    renderPage();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Poems to reread' }),
    ).toBeInTheDocument();
    expect(screen.getByText('The ones that keep working.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'A door never opened' })).toHaveAttribute(
      'href',
      '/p/a-door-never-opened',
    );
    expect(screen.getByText('For the last stanza.')).toBeInTheDocument();
  });

  it('links a piece with no slug by its id', async () => {
    pieces.mockResolvedValue(page([piece({ slug: null })]));
    renderPage();
    expect(await screen.findByRole('link', { name: 'A door never opened' })).toHaveAttribute(
      'href',
      '/p/piece-1',
    );
  });

  /**
   * The two reads are independent on purpose: a failed HEADER must not take the piece list with it,
   * which is the same split mobile's detail screen makes.
   */
  it('still shows the pieces when the header fails to load', async () => {
    detail.mockRejectedValue(new ApiError(500, { code: 'API_UNEXPECTED_ERROR', message: 'nope' }));
    renderPage();

    expect(await screen.findByRole('link', { name: 'A door never opened' })).toBeInTheDocument();
    // Degrades to a generic title rather than an error page.
    expect(screen.getByRole('heading', { level: 1, name: 'Collection' })).toBeInTheDocument();
  });

  it('renders an honest empty state', async () => {
    pieces.mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText('Nothing saved here yet')).toBeInTheDocument();
  });

  /**
   * The distinction this whole page has to get right: removing un-files the piece, it does not
   * delete it. The confirmation says so, and the call touches only the membership.
   */
  it('removes a piece from the collection after confirming that the piece itself survives', async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Remove A door never opened from this collection',
      }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/the piece itself stays published and unchanged/i);
    expect(removePiece).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: /^Remove$/ }));
    await waitFor(() => {
      expect(removePiece).toHaveBeenCalledWith(COLLECTION_ID, 'piece-1');
    });
  });

  it('cancelling the confirm removes nothing', async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Remove A door never opened from this collection',
      }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /keep/i }));

    expect(removePiece).not.toHaveBeenCalled();
  });

  it('pages with the server’s cursor', async () => {
    pieces.mockResolvedValueOnce(page([piece()], 'cursor-2'));
    pieces.mockResolvedValueOnce(
      page([piece({ pieceId: 'piece-2', slug: 'later', title: 'A later piece' })]),
    );

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'More pieces' }));

    expect(await screen.findByRole('link', { name: 'A later piece' })).toBeInTheDocument();
    expect(pieces).toHaveBeenLastCalledWith(COLLECTION_ID, 'cursor-2', expect.anything());
  });
});
