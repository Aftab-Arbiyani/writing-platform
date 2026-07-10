import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { OverviewCards } from './overview-cards';
import type { GrowthPoint, WriterAnalytics } from '../types/analytics.types';

vi.mock('@/features/analytics/components/charts/chart-core', () => ({
  createChart: () => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }),
}));

const WRITER: WriterAnalytics = {
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
  mostPopularPiece: null,
};

const growth: GrowthPoint[] = [
  { periodStart: '2026-07-01', metrics: { views: 100 } },
  { periodStart: '2026-07-30', metrics: { views: 150 } },
];

describe('OverviewCards', () => {
  it('renders the overview metrics from the writer aggregate', () => {
    renderWithProviders(<OverviewCards writer={WRITER} followers={340} growthPoints={growth} />);
    expect(screen.getByText('Total views')).toBeInTheDocument();
    expect(screen.getByText('12K')).toBeInTheDocument();
    expect(screen.getByText('Reads')).toBeInTheDocument();
    expect(screen.getByText('Completion rate')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText('Followers')).toBeInTheDocument();
    expect(screen.getByText('Avg. reading time')).toBeInTheDocument();
    expect(screen.getByText('5m 12s')).toBeInTheDocument();
  });

  it('shows a trend badge for a metric with growth data', () => {
    renderWithProviders(<OverviewCards writer={WRITER} followers={340} growthPoints={growth} />);
    expect(screen.getByText('+50%')).toBeInTheDocument(); // views 100 → 150
  });

  it('renders skeletons while loading', () => {
    renderWithProviders(<OverviewCards growthPoints={[]} loading />);
    expect(screen.queryByText('Total views')).not.toBeInTheDocument();
  });
});
