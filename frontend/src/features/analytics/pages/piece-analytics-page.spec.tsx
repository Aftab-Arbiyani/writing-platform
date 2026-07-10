import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router';

import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';

import { analyticsApi } from '../api/analytics.api';
import type { PieceAnalytics, PieceMeta } from '../types/analytics.types';
import { PieceAnalyticsPage } from './piece-analytics-page';

vi.mock('../api/analytics.api', () => ({
  analyticsApi: { piece: vi.fn(), pieceMeta: vi.fn() },
}));
vi.mock('@/features/analytics/components/charts/chart-core', () => ({
  createChart: () => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }),
}));

const api = vi.mocked(analyticsApi);

const ANALYTICS: PieceAnalytics = {
  pieceId: 'p1',
  views: 4200,
  uniqueViews: 3800,
  reads: 3100,
  completionRate: 0.74,
  averageReadTimeSeconds: 252,
  claps: 320,
  comments: 18,
  responses: 4,
  bookmarks: 66,
  shares: 89,
  readingSources: { internal: 60, external: 20, copyLink: 9 },
  publishedAt: '2026-07-01T00:00:00.000Z',
};

const META: PieceMeta = {
  id: 'p1',
  title: 'شام کی دہلیز پر',
  slug: 'shaam',
  status: 'published',
  visibility: 'public',
  readingTimeSeconds: 300,
  wordCount: 500,
  publishedAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-05T10:00:00.000Z',
};

function renderPage(): void {
  renderWithProviders(
    <Routes>
      <Route path="/me/stats/pieces/:id" element={<PieceAnalyticsPage />} />
    </Routes>,
    { route: '/me/stats/pieces/p1' },
  );
}

describe('PieceAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'authenticated' });
    api.piece.mockResolvedValue(ANALYTICS);
    api.pieceMeta.mockResolvedValue(META);
  });

  it('renders the piece title, metrics, and reading sources', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'شام کی دہلیز پر' })).toBeInTheDocument();
    expect(await screen.findByText('4.2K')).toBeInTheDocument(); // views
    expect(screen.getByText('Views')).toBeInTheDocument();
    expect(screen.getByText('74%')).toBeInTheDocument(); // completion
    expect(screen.getByText('Reading sources')).toBeInTheDocument();
    expect(screen.getByText('Engagement')).toBeInTheDocument();
    // Reading-sources donut exposes its data via the accessible table.
    expect(screen.getByRole('table', { name: /Reading sources/ })).toBeInTheDocument();
  });

  it('surfaces an owner-only error (403/404) with retry', async () => {
    api.piece.mockRejectedValue(new Error('forbidden'));
    renderPage();
    expect(await screen.findByText("Couldn't load your analytics.")).toBeInTheDocument();
  });
});
