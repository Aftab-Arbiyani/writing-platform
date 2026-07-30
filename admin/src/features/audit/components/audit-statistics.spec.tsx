import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { useAuditStatistics } from '../hooks/use-audit';
import { AuditStatistics } from './audit-statistics';

vi.mock('../hooks/use-audit', () => ({ useAuditStatistics: vi.fn() }));

const mockStats = useAuditStatistics as unknown as Mock;

afterEach(() => vi.clearAllMocks());

describe('AuditStatistics', () => {
  it('renders the count cards and top actions', () => {
    mockStats.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        today: 5,
        thisWeek: 20,
        thisMonth: 120,
        topActions: [{ action: 'user.ban', count: 7 }],
        mostActiveActors: [{ actorId: 'abcdef12-3456', count: 4 }],
      },
    });
    renderWithProviders(<AuditStatistics />);
    expect(screen.getByText('Actions today')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('user.ban')).toBeInTheDocument();
    expect(screen.getByText('abcdef12')).toBeInTheDocument();
  });

  it('shows the loading state', () => {
    mockStats.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    renderWithProviders(<AuditStatistics />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('renders an error message', () => {
    mockStats.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error('boom'),
      data: undefined,
    });
    const { container } = renderWithProviders(<AuditStatistics />);
    expect(container.querySelector('.text-danger')?.textContent).toBeTruthy();
  });
});
