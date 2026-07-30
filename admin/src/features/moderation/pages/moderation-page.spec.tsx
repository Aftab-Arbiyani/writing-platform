import { ReportEntityType, ReportPriority, ReportReason, ReportStatus, Role } from '@qalam/shared';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import { useAppeal, useAppeals } from '../hooks/use-appeals';
import { useModerators, useReport, useReports } from '../hooks/use-reports';
import type { Report } from '../types/moderation.types';
import { ModerationPage } from './moderation-page';

vi.mock('../hooks/use-reports', () => ({
  useReports: vi.fn(),
  useReport: vi.fn(),
  useModerators: vi.fn(),
}));
vi.mock('../hooks/use-appeals', () => ({ useAppeals: vi.fn(), useAppeal: vi.fn() }));
vi.mock('../hooks/use-moderation-mutations', () => {
  const m = (): { mutate: () => void; isPending: boolean } => ({
    mutate: vi.fn(),
    isPending: false,
  });
  return {
    useAssignReport: m,
    useSetPriority: m,
    useEscalateReport: m,
    useAddNote: m,
    useResolveReport: m,
    useBulkReports: m,
    useApproveAppeal: m,
    useRejectAppeal: m,
  };
});

const report: Report = {
  id: 'r1',
  entityType: ReportEntityType.Piece,
  entityId: 'p1',
  reportedUserId: 'u1',
  reporterId: 'u2',
  reason: ReportReason.Spam,
  description: null,
  status: ReportStatus.Pending,
  priority: ReportPriority.High,
  severity: null,
  assignedModeratorId: null,
  resolution: null,
  resolutionReason: null,
  resolvedById: null,
  resolvedAt: null,
  hasAppeal: false,
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
};

describe('ModerationPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated', role: Role.SuperAdmin });
    vi.mocked(useReports).mockReturnValue({
      data: { items: [report], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useReports>);
    vi.mocked(useReport).mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
    } as ReturnType<typeof useReport>);
    vi.mocked(useModerators).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useModerators>);
    vi.mocked(useAppeals).mockReturnValue({
      data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAppeals>);
    vi.mocked(useAppeal).mockReturnValue({
      isLoading: false,
      isError: false,
      data: undefined,
    } as ReturnType<typeof useAppeal>);
  });
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.clearAllMocks();
  });

  it('renders the report queue with a row', () => {
    renderWithProviders(<ModerationPage />, { route: '/reports' });
    expect(screen.getByText('Spam')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText(/of 1/)).toBeInTheDocument();
  });

  it('reveals report filters when toggled', () => {
    renderWithProviders(<ModerationPage />, { route: '/reports' });
    expect(screen.queryByText('Reported from')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    expect(screen.getByText('Reported from')).toBeInTheDocument();
  });

  it('switches to the appeals tab', async () => {
    renderWithProviders(<ModerationPage />, { route: '/reports' });
    fireEvent.click(screen.getByRole('tab', { name: 'Appeals' }));
    expect(await screen.findByText('No appeals')).toBeInTheDocument();
  });
});
