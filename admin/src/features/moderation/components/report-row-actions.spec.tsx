import { ReportEntityType, ReportPriority, ReportReason, ReportStatus, Role } from '@qalam/shared';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import type { Report } from '../types/moderation.types';
import { ReportRowActions } from './report-row-actions';

function report(overrides: Partial<Report> = {}): Report {
  return {
    id: 'r1-abcdef',
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
    ...overrides,
  };
}

function render(node: Parameters<typeof renderWithProviders>[0]): void {
  renderWithProviders(node);
}

async function openMenu(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: /actions for report/i }));
  await screen.findByRole('menu');
}

const noop = { onView: vi.fn(), onAssign: vi.fn(), onEscalate: vi.fn(), onResolve: vi.fn() };

describe('ReportRowActions', () => {
  beforeEach(() => useAuthStore.setState({ status: 'authenticated', role: Role.Moderator }));
  afterEach(() => {
    useAuthStore.getState().clear();
    vi.clearAllMocks();
  });

  it('offers the full triage menu to a moderator', async () => {
    render(<ReportRowActions report={report()} {...noop} />);
    await openMenu();
    expect(screen.getByText('View report')).toBeInTheDocument();
    expect(screen.getByText('Assign moderator')).toBeInTheDocument();
    expect(screen.getByText('Escalate')).toBeInTheDocument();
    expect(screen.getByText('Resolve…')).toBeInTheDocument();
  });

  it('fires resolve', async () => {
    const onResolve = vi.fn();
    render(<ReportRowActions report={report()} {...noop} onResolve={onResolve} />);
    await openMenu();
    fireEvent.click(screen.getByText('Resolve…'));
    expect(onResolve).toHaveBeenCalled();
  });

  it('shows only View for a role without report permissions', async () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.User });
    render(<ReportRowActions report={report()} {...noop} />);
    await openMenu();
    expect(screen.getByText('View report')).toBeInTheDocument();
    expect(screen.queryByText('Resolve…')).not.toBeInTheDocument();
  });
});
