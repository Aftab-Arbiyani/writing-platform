import { Role, Visibility } from '@qalam/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { collectionsApi } from '@/lib/collections-api';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import type { Collection } from '@/types/collection';

import { CollectionsPage } from './collections-page';

vi.mock('@/lib/collections-api');

const mine = vi.mocked(collectionsApi.mine);
const create = vi.mocked(collectionsApi.create);
const update = vi.mocked(collectionsApi.update);
const remove = vi.mocked(collectionsApi.remove);

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

describe('CollectionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setSession({ accessToken: 'token', role: Role.User });
    mine.mockResolvedValue(page([collection()]));
  });

  it('lists the reader’s collections, linking each to its detail', async () => {
    renderWithProviders(<CollectionsPage />);
    expect(await screen.findByRole('link', { name: 'Poems to reread' })).toHaveAttribute(
      'href',
      '/me/collections/col-1',
    );
    expect(screen.getByText('3 pieces')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();
  });

  it('renders an empty state that offers the way in', async () => {
    mine.mockResolvedValue(page([]));
    renderWithProviders(<CollectionsPage />);

    expect(await screen.findByText('No collections yet')).toBeInTheDocument();
    // Two create affordances (header + empty state), both live.
    expect(screen.getAllByRole('button', { name: /New collection/ })).toHaveLength(2);
  });

  it('creates a collection, private by default', async () => {
    create.mockResolvedValue(collection({ id: 'col-new', title: 'Rainy days' }));
    renderWithProviders(<CollectionsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /New collection/ }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Rainy days' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({ title: 'Rainy days', visibility: Visibility.Private });
    });
  });

  it('refuses an empty name', async () => {
    renderWithProviders(<CollectionsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /New collection/ }));
    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('renames a collection through PATCH', async () => {
    update.mockResolvedValue(collection({ title: 'Poems, reread' }));
    renderWithProviders(<CollectionsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Actions for Poems to reread' }));
    fireEvent.click(await screen.findByText('Rename'));
    const name = await screen.findByLabelText('Name');
    expect(name).toHaveValue('Poems to reread');

    fireEvent.change(name, { target: { value: 'Poems, reread' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith('col-1', { title: 'Poems, reread' });
    });
  });

  /**
   * Deleting a collection must not read as deleting the writing in it. The confirmation says so
   * explicitly, and this pins the wording because that is the whole risk of the action.
   */
  it('deletes only after confirming, and says the pieces stay', async () => {
    remove.mockResolvedValue(undefined);
    renderWithProviders(<CollectionsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Actions for Poems to reread' }));
    fireEvent.click(await screen.findByText('Delete'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/the pieces in it stay where they are/i);
    expect(remove).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: /^Delete$/ }));
    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith('col-1');
    });
  });

  /**
   * The default "Favorites" collection cannot be renamed (`COLLECTION_DEFAULT_IMMUTABLE`), so its
   * menu is ABSENT rather than present-and-refused — the C-1 / W3c-1 rule.
   */
  it('offers no rename/delete menu on the default collection', async () => {
    mine.mockResolvedValue(page([collection({ id: 'fav', title: 'Favorites', isDefault: true })]));
    renderWithProviders(<CollectionsPage />);

    expect(await screen.findByRole('link', { name: 'Favorites' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument();
  });

  it('pages with the server’s cursor', async () => {
    mine.mockResolvedValueOnce(page([collection()], 'cursor-2'));
    mine.mockResolvedValueOnce(page([collection({ id: 'col-2', title: 'Second page' })]));

    renderWithProviders(<CollectionsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'More collections' }));

    expect(await screen.findByRole('link', { name: 'Second page' })).toBeInTheDocument();
    expect(mine).toHaveBeenLastCalledWith('cursor-2', expect.anything());
  });

  it('surfaces a failed read with a retry', async () => {
    mine.mockRejectedValue(new ApiError(500, { code: 'API_UNEXPECTED_ERROR', message: 'Boom.' }));
    renderWithProviders(<CollectionsPage />);
    expect(await screen.findByText('Couldn’t load your collections.')).toBeInTheDocument();
  });
});
