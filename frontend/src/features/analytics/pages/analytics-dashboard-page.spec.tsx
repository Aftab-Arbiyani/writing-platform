import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CursorPage } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { useMe } from '@/hooks/use-me';
import { useAuthStore } from '@/stores/auth.store';

import { analyticsApi } from '../api/analytics.api';
import type { Dashboard, PieceListItem } from '../types/analytics.types';
import { AnalyticsDashboardPage } from './analytics-dashboard-page';

vi.mock('../api/analytics.api', () => ({
  analyticsApi: {
    dashboard: vi.fn(),
    growth: vi.fn(),
    myPieces: vi.fn(),
    trending: vi.fn(),
  },
}));
vi.mock('@/hooks/use-me', () => ({ useMe: vi.fn() }));
vi.mock('@/features/analytics/components/charts/chart-core', () => ({
  createChart: () => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }),
}));

const api = vi.mocked(analyticsApi);

const DASHBOARD: Dashboard = {
  writer: {
    totalViews: 12000,
    uniqueViews: 8000,
    reads: 8100,
    completionRate: 0.65,
    totalReadSeconds: 100000,
    averageReadTimeSeconds: 312,
    followersGained: 214,
    piecesPublished: 12,
    piecesArchived: 0,
    commentsReceived: 40,
    clapsReceived: 900,
    bookmarksReceived: 75,
    responsesReceived: 12,
    mostPopularPiece: { pieceId: 'p1', title: 'Barish', slug: 'barish', views: 4200 },
  },
  reader: {
    piecesRead: 50,
    readingTimeSeconds: 100000,
    completedReads: 40,
    currentStreak: 5,
    longestStreak: 12,
    favoriteGenres: [{ key: 'ghazal', label: 'Ghazal', count: 20 }],
    favoriteLanguages: [{ key: 'ur', label: 'اردو', count: 30 }],
  },
};

const emptyPieces: CursorPage<PieceListItem> = {
  items: [],
  meta: { nextCursor: null, hasMore: false },
};

function seed(): void {
  api.dashboard.mockResolvedValue(DASHBOARD);
  api.growth.mockResolvedValue({ period: 'daily', points: [] });
  api.myPieces.mockResolvedValue(emptyPieces);
  api.trending.mockResolvedValue({
    period: 'weekly',
    pieces: [],
    writers: [],
    genres: [],
    tags: [],
  });
  vi.mocked(useMe).mockReturnValue({
    data: { counts: { followers: 340 } },
  } as unknown as ReturnType<typeof useMe>);
}

describe('AnalyticsDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'authenticated' });
    seed();
  });

  it('renders the writer overview and top performer', async () => {
    renderWithProviders(<AnalyticsDashboardPage />, { route: '/me/stats' });
    expect(await screen.findByRole('heading', { name: 'Your stats' })).toBeInTheDocument();
    expect(await screen.findByText('12K')).toBeInTheDocument();
    expect(screen.getByText('Total views')).toBeInTheDocument();
    expect(screen.getByText('Top performer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  /**
   * W7c moved the reader aggregate to `/me/reading`. These assert the MOVE, not just the new page:
   * a reader surface that still renders here would leave the audience confusion in place.
   */
  it('no longer renders the reader aggregate, and links to where it went', async () => {
    renderWithProviders(<AnalyticsDashboardPage />, { route: '/me/stats' });
    await screen.findByText('12K');

    // The ReaderInsights cards are gone from this page.
    expect(screen.queryByText('Reading habits')).not.toBeInTheDocument();
    expect(screen.queryByText('What you read most')).not.toBeInTheDocument();
    expect(screen.queryByText('Pieces read')).not.toBeInTheDocument();
    expect(screen.queryByText('Longest streak')).not.toBeInTheDocument();

    // And the reader surface is reachable from here.
    expect(screen.getByRole('button', { name: /Your reading/ })).toBeInTheDocument();
  });

  it('shows the "no published pieces" empty state', async () => {
    api.dashboard.mockResolvedValue({
      ...DASHBOARD,
      writer: { ...DASHBOARD.writer, piecesPublished: 0, mostPopularPiece: null },
    });
    renderWithProviders(<AnalyticsDashboardPage />, { route: '/me/stats' });
    expect(await screen.findByText('Numbers need words first.')).toBeInTheDocument();
  });

  it('shows an error state with retry when the dashboard fails', async () => {
    api.dashboard.mockRejectedValue(new Error('boom'));
    renderWithProviders(<AnalyticsDashboardPage />, { route: '/me/stats' });
    expect(await screen.findByText("Couldn't load your analytics.")).toBeInTheDocument();
  });
});
