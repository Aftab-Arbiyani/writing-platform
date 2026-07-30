import type { CursorPage } from '@/lib/api-client';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { searchApi } from '../api/search.api';
import type { SearchPiece, SearchWriter } from '../types/search.types';
import { PieceResults, WriterResults } from './search-result-lists';

vi.mock('../api/search.api', () => ({
  searchApi: { pieces: vi.fn(), writers: vi.fn() },
}));

const pieces = vi.mocked(searchApi.pieces);
const writers = vi.mocked(searchApi.writers);

function page<T>(items: T[]): CursorPage<T> {
  return { items, meta: { nextCursor: null, hasMore: false } };
}

function makePiece(over: Partial<SearchPiece> = {}): SearchPiece {
  return {
    id: 'p1',
    slug: 'barish-ki-raat',
    title: 'Barish ki raat',
    subtitle: 'On the rain that remembers.',
    featuredQuote: null,
    coverImageKey: null,
    language: { code: 'ur', direction: 'rtl', nativeName: 'اردو' },
    genre: { slug: 'ghazal', name: 'Ghazal' },
    author: { username: 'meera_k', penName: 'Meera K', avatarKey: null },
    stats: { likes: 2, claps: 30, comments: 4, responses: 0 },
    visibility: 'public',
    wordCount: 400,
    readingTimeSeconds: 240,
    publishedAt: '2026-07-01T00:00:00.000Z',
    rank: 0.9,
    ...over,
  };
}

function makeWriter(over: Partial<SearchWriter> = {}): SearchWriter {
  return {
    userId: 'u1',
    username: 'meera_k',
    penName: 'Meera K',
    bio: 'Writes ghazals at midnight.',
    avatarKey: null,
    isPrivate: false,
    followersCount: 1200,
    piecesCount: 18,
    rank: 0.8,
    ...over,
  };
}

describe('PieceResults', () => {
  beforeEach(() => {
    pieces.mockReset();
  });

  it('renders piece cards linking to the reading view, highlighting the match', async () => {
    pieces.mockResolvedValue(page([makePiece()]));
    const { container } = renderWithProviders(<PieceResults q="barish" filters={{}} />);

    const link = await screen.findByRole('link', { name: 'Barish ki raat' });
    expect(link).toHaveAttribute('href', '/p/barish-ki-raat');
    expect(container.querySelector('mark')?.textContent).toBe('Barish');
  });

  it('shows the literary no-results state when nothing matches', async () => {
    pieces.mockResolvedValue(page([]));
    renderWithProviders(<PieceResults q="zzzz" filters={{}} />);
    expect(await screen.findByText('No pieces found.')).toBeInTheDocument();
  });
});

describe('WriterResults', () => {
  beforeEach(() => {
    writers.mockReset();
  });

  it('renders writer cards linking to the profile', async () => {
    writers.mockResolvedValue(page([makeWriter()]));
    renderWithProviders(<WriterResults q="meera" filters={{}} />);

    const link = await screen.findByRole('link', { name: 'Meera K' });
    expect(link).toHaveAttribute('href', '/@meera_k');
    expect(screen.getByText('@meera_k')).toBeInTheDocument();
  });

  it('shows a teaser (no bio) for a private account', async () => {
    writers.mockResolvedValue(page([makeWriter({ isPrivate: true, bio: null })]));
    renderWithProviders(<WriterResults q="meera" filters={{}} />);
    expect(await screen.findByText('This writer keeps a private notebook.')).toBeInTheDocument();
  });
});
