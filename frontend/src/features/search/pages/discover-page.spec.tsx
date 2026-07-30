import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CursorPage } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';

import { discoverApi } from '../api/discover.api';
import type { PieceSummary, WriterCard } from '../types/search.types';
import { DiscoverPage } from './discover-page';

vi.mock('../api/discover.api', () => ({
  discoverApi: {
    writers: vi.fn(),
    pieces: vi.fn(),
    trendingPieces: vi.fn(),
    tags: vi.fn(),
    genres: vi.fn(),
    languages: vi.fn(),
  },
}));

const page = <T,>(items: T[]): CursorPage<T> => ({
  items,
  meta: { nextCursor: null, hasMore: false },
});

function makePiece(id: string, title: string): PieceSummary {
  return {
    id,
    slug: id,
    title,
    subtitle: null,
    featuredQuote: null,
    coverImageKey: null,
    language: { code: 'ur', direction: 'rtl', nativeName: 'اردو' },
    genre: { slug: 'ghazal', name: 'Ghazal' },
    author: { username: 'meera_k', penName: 'Meera K', avatarKey: null },
    stats: { likes: 0, claps: 5, comments: 1, responses: 0 },
    visibility: 'public',
    wordCount: 300,
    readingTimeSeconds: 180,
    publishedAt: '2026-07-01T00:00:00.000Z',
  };
}

const WRITER: WriterCard = {
  username: 'meera_k',
  penName: 'Meera K',
  avatarKey: null,
  bio: 'Ghazals at midnight.',
  followersCount: 900,
  piecesCount: 12,
};

function seedAll(): void {
  vi.mocked(discoverApi.pieces).mockResolvedValue(page([makePiece('p1', 'Featured piece')]));
  vi.mocked(discoverApi.trendingPieces).mockResolvedValue(
    page([makePiece('p2', 'Trending piece')]),
  );
  vi.mocked(discoverApi.writers).mockResolvedValue(page([WRITER]));
  vi.mocked(discoverApi.genres).mockResolvedValue(
    page([{ slug: 'ghazal', name: 'Ghazal', pieceCount: 8 }]),
  );
  vi.mocked(discoverApi.tags).mockResolvedValue(
    page([{ slug: 'ishq', name: 'ishq', pieceCount: 6 }]),
  );
  vi.mocked(discoverApi.languages).mockResolvedValue(
    page([{ code: 'ur', nativeName: 'اردو', direction: 'rtl', pieceCount: 20 }]),
  );
}

describe('DiscoverPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders every discovery section from real backend reads', async () => {
    seedAll();
    renderWithProviders(<DiscoverPage />, { route: '/discover' });

    // Wait for real content (past the loading skeletons), then assert the sections + data.
    expect(await screen.findByRole('link', { name: 'Featured piece' })).toBeInTheDocument();

    expect(screen.getByText('Featured pieces')).toBeInTheDocument();
    expect(screen.getByText('Trending now')).toBeInTheDocument();
    expect(screen.getByText('Featured writers')).toBeInTheDocument();
    expect(screen.getByText('Writers to follow')).toBeInTheDocument();
    expect(screen.getByText('Popular genres')).toBeInTheDocument();
    expect(screen.getByText('Popular tags')).toBeInTheDocument();
    expect(screen.getByText('Browse by language')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Trending piece' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Meera K' }).length).toBeGreaterThan(0);
  });

  it('shows the empty state when every slice is empty', async () => {
    vi.mocked(discoverApi.pieces).mockResolvedValue(page([]));
    vi.mocked(discoverApi.trendingPieces).mockResolvedValue(page([]));
    vi.mocked(discoverApi.writers).mockResolvedValue(page([]));
    vi.mocked(discoverApi.genres).mockResolvedValue(page([]));
    vi.mocked(discoverApi.tags).mockResolvedValue(page([]));
    vi.mocked(discoverApi.languages).mockResolvedValue(page([]));

    renderWithProviders(<DiscoverPage />, { route: '/discover' });
    expect(await screen.findByText('Nothing to discover yet.')).toBeInTheDocument();
  });
});
