import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { useOverview, useUserAnalytics } from '../hooks/use-analytics';
import type { PlatformOverview, UserAnalytics } from '../types/analytics.types';
import { OverviewSection } from './overview-section';

// Stub the ECharts loader so charts render without a real canvas.
vi.mock('../charts/echarts-loader', () => ({
  loadECharts: () =>
    Promise.resolve({
      init: () => ({
        setOption: () => undefined,
        resize: () => undefined,
        dispose: () => undefined,
      }),
      use: () => undefined,
    }),
}));

vi.mock('../hooks/use-analytics', () => ({
  useOverview: vi.fn(),
  useUserAnalytics: vi.fn(),
}));

function overview(): PlatformOverview {
  return {
    totalUsers: 50,
    verifiedUsers: 30,
    activeUsers: 20,
    newUsers: 12,
    privateAccounts: 8,
    publishedPieces: 100,
    drafts: 25,
    comments: 3,
    responses: 2,
    reports: 40,
    resolvedReports: 30,
    bookmarks: 4,
    claps: 5,
    followers: 6,
    databaseSizeBytes: 1048576,
    growthRatePct: 15,
    generatedAt: '2026-07-11T00:00:00.000Z',
  };
}

function users(): UserAnalytics {
  return {
    registrations: 12,
    activeUsers: 18,
    retentionPct: 40,
    dailyActiveUsers: 5,
    weeklyActiveUsers: 12,
    monthlyActiveUsers: 20,
    topCountries: [],
    topLanguages: [],
    topDevices: [],
    registrationsSeries: [],
  };
}

afterEach(() => vi.clearAllMocks());

describe('OverviewSection', () => {
  it('renders headline metrics, DAU/WAU/MAU, growth, and chart containers', () => {
    (useOverview as Mock).mockReturnValue({ data: overview(), isLoading: false, isError: false });
    (useUserAnalytics as Mock).mockReturnValue({ data: users(), isLoading: false, isError: false });

    renderWithProviders(<OverviewSection filters={{ range: '30d' }} />);

    expect(screen.getByText('Total users')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('Daily active')).toBeInTheDocument();
    expect(screen.getByText('+15.0%')).toBeInTheDocument(); // growth badge
    expect(screen.getByRole('heading', { name: 'Content mix' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Engagement' })).toBeInTheDocument();
    // Storage renders the formatted DB size.
    expect(screen.getByText('1.0 MB')).toBeInTheDocument();
  });

  it('shows the skeleton on first load', () => {
    (useOverview as Mock).mockReturnValue({ data: undefined, isLoading: true, isError: false });
    (useUserAnalytics as Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    renderWithProviders(<OverviewSection filters={{ range: '30d' }} />);
    expect(screen.getByRole('status', { name: 'Loading analytics' })).toBeInTheDocument();
  });

  it('shows an error with retry', () => {
    (useOverview as Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('nope'),
      refetch: vi.fn(),
    });
    (useUserAnalytics as Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    renderWithProviders(<OverviewSection filters={{ range: '30d' }} />);
    expect(screen.getByText('Couldn’t load analytics')).toBeInTheDocument();
  });
});
