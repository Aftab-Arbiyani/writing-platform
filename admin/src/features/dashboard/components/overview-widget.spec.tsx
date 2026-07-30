import { Role } from '@qalam/shared';
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import { OverviewWidget } from './overview-widget';
import { usePlatformStats } from '../hooks/use-platform-stats';
import type { PlatformStats } from '../types/dashboard.types';

vi.mock('../hooks/use-platform-stats');

const STATS: PlatformStats = {
  totalUsers: 42,
  dailyActiveUsers: 5,
  monthlyActiveUsers: 20,
  newRegistrations: 3,
  publishedPieces: 8,
  draftPieces: 2,
  comments: 9,
  claps: 7,
  bookmarks: 4,
  collections: 1,
  views: 100,
  reads: 60,
};

function mockStats(over: Record<string, unknown>): void {
  vi.mocked(usePlatformStats).mockReturnValue(
    over as unknown as ReturnType<typeof usePlatformStats>,
  );
}

beforeEach(() => useAuthStore.setState({ status: 'authenticated', role: Role.SuperAdmin }));
afterEach(() => {
  useAuthStore.getState().clear();
  vi.clearAllMocks();
});

describe('OverviewWidget', () => {
  it('renders real platform counts', () => {
    mockStats({ data: STATS, isLoading: false, isError: false, refetch: vi.fn() });
    renderWithProviders(<OverviewWidget />);
    expect(screen.getByText('Total users')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Daily active users')).toBeInTheDocument();
  });

  it('shows honest unavailable tiles for fields the backend does not expose', () => {
    mockStats({ data: STATS, isLoading: false, isError: false, refetch: vi.fn() });
    renderWithProviders(<OverviewWidget />);
    expect(screen.getByText('Verified users')).toBeInTheDocument();
    expect(screen.getByText('Storage usage')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows access-denied when the operator lacks analytics.view', () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Moderator });
    mockStats({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
    renderWithProviders(<OverviewWidget />);
    expect(screen.getByText(/analytics\.view/i)).toBeInTheDocument();
  });
});
