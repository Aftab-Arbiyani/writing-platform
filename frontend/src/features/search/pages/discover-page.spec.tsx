import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CursorPage } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';

import { useAuthStore } from '@/stores/auth.store';

import { discoverApi } from '../api/discover.api';
import { retrievalApi } from '../api/retrieval.api';
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

// The AF4 shelves (W5) gate on the app-level availability hook and read through the retrieval api.
// Both are mocked rather than left to the real api-client: an unmocked gate read would make the
// shelves' absence depend on a failed fetch, which is not evidence that they self-silence.
vi.mock('../api/retrieval.api', () => ({
  retrievalApi: {
    features: vi.fn(),
    usage: vi.fn(),
    recommendations: vi.fn(),
    search: vi.fn(),
    suggestions: vi.fn(),
    savedSearches: vi.fn(),
    saveSearch: vi.fn(),
    deleteSavedSearch: vi.fn(),
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
    // Default posture: signed out. Discover is a public editorial page and that is its majority
    // traffic — before D5 the default was "AI dark", which AF1 seeded and which hid the shelves for
    // a different reason.
    useAuthStore.setState({ status: 'anonymous' });
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

  /**
   * The recommendation shelves (W5, re-gated by D5). The editorial page is public and must be
   * unchanged for a reader with no session — so the interesting assertions are the silent ones.
   *
   * "Asks for nothing" is the load-bearing half. `/ai/recommendations` still needs a session, and a
   * 401 here would take the api layer's `onUnauthorized()` path and sign the reader out of a page
   * they were browsing anonymously (48 §3.25). The feature flag used to prevent that as a side
   * effect; the auth gate now does it on purpose.
   */
  describe('Recommendation shelves', () => {
    it('renders nothing, and asks for NOTHING, for a signed-out reader', async () => {
      seedAll();
      renderWithProviders(<DiscoverPage />, { route: '/discover' });

      await screen.findByRole('link', { name: 'Featured piece' });
      expect(screen.queryByText('Recommended for you')).not.toBeInTheDocument();
      expect(screen.queryByText('Pick up next')).not.toBeInTheDocument();
      expect(retrievalApi.recommendations).not.toHaveBeenCalled();
    });

    it('renders a shelf with each item explained when recommendations are live', async () => {
      seedAll();
      useAuthStore.setState({ status: 'authenticated' });
      vi.mocked(retrievalApi.recommendations).mockImplementation((args) =>
        Promise.resolve({
          kind: args.kind,
          items:
            args.kind === 'feed'
              ? [
                  {
                    id: 'p9',
                    kind: args.kind,
                    targetType: 'piece',
                    title: 'A recommended piece',
                    summary: 'About the rain.',
                    object: {},
                    score: 0.9,
                    confidence: 0.9,
                    reason: 'Recommended for you from across Qalam',
                    influencedBy: [],
                    evidence: [],
                    navigation: { kind: 'piece', ref: 'a-recommended-piece' },
                  },
                ]
              : [],
          meta: {
            sources: [],
            totalCandidates: 1,
            returned: 1,
            confidence: 0.9,
            degraded: false,
          },
        } as unknown as Awaited<ReturnType<typeof retrievalApi.recommendations>>),
      );

      renderWithProviders(<DiscoverPage />, { route: '/discover' });

      // The heading appears with the skeleton, so the ITEM is what proves the read resolved —
      // asserting the heading alone would pass on a shelf that never loaded.
      expect(
        await screen.findByRole('link', { name: 'Story: A recommended piece' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Recommended for you')).toBeInTheDocument();
      // Every recommendation explains itself — that is AF4's design law, not a nicety.
      expect(screen.getByText(/Recommended for you from across Qalam/)).toBeInTheDocument();
      // The empty kind stays silent rather than printing a hollow heading.
      await waitFor(() => {
        expect(screen.queryByText('Pick up next')).not.toBeInTheDocument();
      });
    });
  });
});
