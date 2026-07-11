import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { useReportStatistics, useReportTrends } from '../hooks/use-reports';
import { ReportStatistics } from './report-statistics';

vi.mock('../hooks/use-reports', () => ({
  useReportStatistics: vi.fn(),
  useReportTrends: vi.fn(),
}));

const mockStats = useReportStatistics as unknown as Mock;
const mockTrends = useReportTrends as unknown as Mock;

afterEach(() => vi.clearAllMocks());

describe('ReportStatistics', () => {
  it('renders the count cards, breakdowns, and a formatted avg resolution', () => {
    mockStats.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        openReports: 4,
        resolvedReports: 30,
        dismissedReports: 6,
        avgResolutionSeconds: 9000, // 2h 30m
        byStatus: { pending: 4, resolved: 30 },
        bySeverity: { high: 2 },
        byCategory: { spam: 12 },
        moderatorPerformance: [{ moderatorId: 'mod12345-x', resolved: 8, avgSeconds: 3600 }],
      },
    });
    mockTrends.mockReturnValue({ data: { from: '', to: '', points: [] } });

    renderWithProviders(<ReportStatistics />);
    expect(screen.getByText('Open reports')).toBeInTheDocument();
    expect(screen.getByText('Avg resolution')).toBeInTheDocument();
    expect(screen.getByText('2h 30m')).toBeInTheDocument();
    expect(screen.getByText('By severity')).toBeInTheDocument();
    expect(screen.getByText('mod12345')).toBeInTheDocument();
  });

  it('shows the loading state', () => {
    mockStats.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    mockTrends.mockReturnValue({ data: undefined });
    renderWithProviders(<ReportStatistics />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
});
