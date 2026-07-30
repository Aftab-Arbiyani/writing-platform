import { screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useProfile } from '@/hooks/use-profile';
import { ApiError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';

import { readingApi } from '../api/reading.api';
import type { PieceDetail, PieceEngagement } from '../types/reading.types';
import { PiecePage } from './piece-page';

vi.mock('../api/reading.api', () => ({
  readingApi: {
    bySlug: vi.fn(),
    byId: vi.fn(),
    engagement: vi.fn(),
    related: vi.fn(),
    like: vi.fn(),
    unlike: vi.fn(),
    bookmark: vi.fn(),
    unbookmark: vi.fn(),
    share: vi.fn(),
  },
}));

// The author card is a secondary, degrade-gracefully surface with its own app-level query; the
// page's own contract is what is under test here, so the profile is stubbed rather than served.
vi.mock('@/hooks/use-profile', () => ({ useProfile: vi.fn() }));

const PIECE_ID = '0197d2f4-1c3a-7000-8000-000000000001';

function makePiece(over: Partial<PieceDetail> = {}): PieceDetail {
  return {
    id: PIECE_ID,
    author: { username: 'meera_k', penName: 'Meera K' },
    title: 'A door never opened',
    subtitle: 'On the rooms we leave unentered.',
    slug: 'a-door-never-opened',
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The body.' }] }],
    },
    featuredQuote: null,
    coverImageKey: null,
    language: {
      id: 'l1',
      code: 'en',
      nameEn: 'English',
      nativeName: 'English',
      direction: 'ltr',
      script: null,
    },
    genre: { id: 'g1', slug: 'ghazal', name: 'Ghazal' },
    tags: [{ id: 't1', slug: 'barish', name: 'barish' }],
    status: 'published',
    visibility: 'public',
    wordCount: 500,
    readingTimeSeconds: 360,
    publishedAt: '2026-07-01T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...over,
  } as PieceDetail;
}

const ENGAGEMENT: PieceEngagement = {
  stats: { likes: 5, claps: 1200, bookmarks: 2, comments: 0, responses: 3, shares: 0 },
  viewer: { hasLiked: true, clapCount: 4, hasBookmarked: false },
};

/** Render at a real `/p/:slug` route so `useParams` resolves the way it does in the app. */
function renderAt(pathParam: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/p/:slug" element={<PiecePage />} />
    </Routes>,
    { route: `/p/${pathParam}` },
  );
}

describe('PiecePage', () => {
  beforeEach(() => {
    // Call history has to be reset per test: the id/slug dispatch assertions below check that
    // the *other* endpoint was never reached.
    vi.clearAllMocks();
    vi.mocked(readingApi.engagement).mockResolvedValue(ENGAGEMENT);
    vi.mocked(readingApi.related).mockResolvedValue([]);
    vi.mocked(useProfile).mockReturnValue({ data: undefined } as ReturnType<typeof useProfile>);
  });

  it('renders the piece: title, author, meta and body', async () => {
    vi.mocked(readingApi.bySlug).mockResolvedValue(makePiece());
    const { container } = renderAt('a-door-never-opened');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'A door never opened' }),
    ).toBeInTheDocument();
    expect(screen.getByText('On the rooms we leave unentered.')).toBeInTheDocument();
    // Two links carry the author: the byline in the header and the author card below the piece.
    // Both must point at the profile — scope to the header for the byline's own assertion.
    // (`<header>` inside an `<article>` is not a banner landmark, so it is queried by element.)
    const byline = container.querySelector('header');
    expect(within(byline as HTMLElement).getByRole('link', { name: 'Meera K' })).toHaveAttribute(
      'href',
      '/@meera_k',
    );
    expect(screen.getByText('6 min')).toBeInTheDocument();
    expect(screen.getByText('Ghazal')).toBeInTheDocument();
    expect(screen.getByText('The body.')).toBeInTheDocument();
    expect(readingApi.bySlug).toHaveBeenCalledWith('a-door-never-opened', expect.anything());
  });

  it('loads by id when the URL carries one (a piece with no slug yet)', async () => {
    vi.mocked(readingApi.byId).mockResolvedValue(makePiece({ slug: null, status: 'draft' }));
    renderAt(PIECE_ID);

    await screen.findByRole('heading', { level: 1, name: 'A door never opened' });
    expect(readingApi.byId).toHaveBeenCalledWith(PIECE_ID, expect.anything());
    expect(readingApi.bySlug).not.toHaveBeenCalled();
  });

  it('shows a not-found state with a way back on a 404', async () => {
    vi.mocked(readingApi.bySlug).mockRejectedValue(
      new ApiError(404, { code: 'PIECE_NOT_FOUND', message: 'nope' }),
    );
    renderAt('gone');

    expect(await screen.findByText('This piece isn’t here.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the feed' })).toHaveAttribute('href', '/feed');
  });

  it('renders the engagement counts once they arrive', async () => {
    vi.mocked(readingApi.bySlug).mockResolvedValue(makePiece());
    renderAt('a-door-never-opened');

    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => {
      expect(screen.getByLabelText('1200 claps')).toBeInTheDocument();
    });
    expect(readingApi.engagement).toHaveBeenCalledWith(PIECE_ID, expect.anything());
  });

  it('flips the article to RTL for an RTL language', async () => {
    vi.mocked(readingApi.bySlug).mockResolvedValue(
      makePiece({
        language: {
          id: 'l2',
          code: 'ur',
          nameEn: 'Urdu',
          nativeName: 'اردو',
          direction: 'rtl',
          script: 'Nastaliq',
        },
      }),
    );
    const { container } = renderAt('a-door-never-opened');

    await screen.findByRole('heading', { level: 1 });
    expect(container.querySelector('.qalam-prose')).toHaveAttribute('dir', 'rtl');
  });
});
