import { Role, Visibility } from '@qalam/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { collectionsApi } from '@/lib/collections-api';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import type { Collection } from '@/types/collection';

import { SaveToCollectionDialog } from './save-to-collection-dialog';

vi.mock('@/lib/collections-api');

const mine = vi.mocked(collectionsApi.mine);
const create = vi.mocked(collectionsApi.create);
const addPiece = vi.mocked(collectionsApi.addPiece);

const PIECE_ID = 'piece-1';

function collection(over: Partial<Collection> = {}): Collection {
  return {
    id: 'col-1',
    title: 'Poems to reread',
    slug: 'poems-to-reread',
    description: null,
    coverImageKey: null,
    visibility: Visibility.Private,
    isDefault: false,
    piecesCount: 3,
    createdAt: new Date('2026-08-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-08-01T00:00:00Z').toISOString(),
    ...over,
  };
}

function page(items: Collection[], nextCursor: string | null = null) {
  return { items, meta: { nextCursor, hasMore: nextCursor !== null } };
}

function open() {
  return renderWithProviders(
    <SaveToCollectionDialog
      open
      onClose={vi.fn()}
      pieceId={PIECE_ID}
      pieceTitle="A door never opened"
    />,
  );
}

describe('SaveToCollectionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setSession({ accessToken: 'token', role: Role.User });
    mine.mockResolvedValue(page([collection()]));
    addPiece.mockResolvedValue(undefined);
  });

  it('lists the reader’s collections with their piece counts', async () => {
    mine.mockResolvedValue(
      page([
        collection(),
        collection({ id: 'col-2', title: 'Favorites', isDefault: true, piecesCount: 1 }),
      ]),
    );
    open();

    expect(await screen.findByText('Poems to reread')).toBeInTheDocument();
    expect(screen.getByText('3 pieces')).toBeInTheDocument();
    // Singular, not "1 pieces".
    expect(screen.getByText('1 piece')).toBeInTheDocument();
  });

  it('saves the piece into the collection the reader picks', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: /Poems to reread/ }));

    await waitFor(() => {
      expect(addPiece).toHaveBeenCalledWith('col-1', PIECE_ID, undefined);
    });
    expect(await screen.findByText('Saved to Poems to reread')).toBeInTheDocument();
  });

  it('tells a reader with no collections that making one is the way in', async () => {
    mine.mockResolvedValue(page([]));
    open();
    expect(await screen.findByText(/don’t have any collections yet/)).toBeInTheDocument();
  });

  /**
   * The chain is what keeps "save this" a single gesture for a reader who has no collection yet:
   * the form dialog resolves with what it created, and the piece goes straight into it.
   */
  it('chains create → save so a new collection receives the piece immediately', async () => {
    mine.mockResolvedValue(page([]));
    create.mockResolvedValue(collection({ id: 'col-new', title: 'Rainy days' }));
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'New collection' }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Rainy days' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        title: 'Rainy days',
        visibility: Visibility.Private,
      });
    });
    // …and the piece lands in it without a second trip.
    await waitFor(() => {
      expect(addPiece).toHaveBeenCalledWith('col-new', PIECE_ID, undefined);
    });
  });

  it('surfaces a failed save rather than claiming success', async () => {
    addPiece.mockRejectedValue(
      new ApiError(500, { code: 'API_UNEXPECTED_ERROR', message: 'Boom.' }),
    );
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Poems to reread/ }));

    expect(await screen.findByText('Couldn’t save it')).toBeInTheDocument();
    expect(screen.queryByText(/^Saved to/)).not.toBeInTheDocument();
  });

  it('surfaces a failed read with a retry', async () => {
    mine.mockRejectedValue(new ApiError(500, { code: 'API_UNEXPECTED_ERROR', message: 'Boom.' }));
    open();
    expect(await screen.findByText('Couldn’t load your collections.')).toBeInTheDocument();
  });
});
