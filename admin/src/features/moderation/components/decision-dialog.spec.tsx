import {
  ReportEntityType,
  ReportPriority,
  ReportReason,
  ReportResolution,
  ReportStatus,
  Role,
} from '@qalam/shared';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import type { Report } from '../types/moderation.types';
import { DecisionDialog } from './decision-dialog';

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('../hooks/use-moderation-mutations', () => ({
  useResolveReport: () => ({ mutate, isPending: false }),
}));

const report: Report = {
  id: 'r1',
  entityType: ReportEntityType.Piece,
  entityId: 'p1',
  reportedUserId: 'u1',
  reporterId: 'u2',
  reason: ReportReason.Spam,
  description: null,
  status: ReportStatus.Pending,
  priority: ReportPriority.Normal,
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

describe('DecisionDialog', () => {
  beforeEach(() => useAuthStore.setState({ status: 'authenticated', role: Role.SuperAdmin }));
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.clearAllMocks();
  });

  it('renders nothing without a report', () => {
    renderWithProviders(<DecisionDialog report={null} onClose={vi.fn()} />);
    expect(screen.queryByText('Resolve report')).not.toBeInTheDocument();
  });

  it('applies the decision with the entered reason', () => {
    renderWithProviders(<DecisionDialog report={report} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/why this decision/i), {
      target: { value: 'clearly spam' },
    });
    fireEvent.click(screen.getByRole('button', { name: /apply decision/i }));
    expect(mutate).toHaveBeenCalledWith(
      {
        id: 'r1',
        payload: {
          resolution: ReportResolution.NoAction,
          reason: 'clearly spam',
          severity: undefined,
        },
      },
      expect.anything(),
    );
  });
});
