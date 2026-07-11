import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { renderWithProviders } from '@/test/render';

import type { AuditLog } from '../types/audit.types';
import { useAuditEntry } from '../hooks/use-audit';
import { AuditDetailDrawer } from './audit-detail-drawer';

vi.mock('../hooks/use-audit', () => ({ useAuditEntry: vi.fn() }));

const mockEntry = useAuditEntry as unknown as Mock;

function entry(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'audit-1',
    action: 'user.ban',
    category: 'user',
    actorId: 'actor-1',
    actorRole: 'admin',
    targetId: 'user-9',
    targetType: 'user',
    metadata: { before: { banned: false }, after: { banned: true } },
    ip: '10.0.0.1',
    requestId: 'req-1',
    createdAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => vi.clearAllMocks());

describe('AuditDetailDrawer', () => {
  it('renders the entry details with the device-not-exposed note', () => {
    mockEntry.mockReturnValue({ isLoading: false, isError: false, data: entry() });
    renderWithProviders(<AuditDetailDrawer id="audit-1" onClose={vi.fn()} />);
    expect(screen.getByText('user.ban')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
    expect(
      screen.getByText('Device / user-agent is not exposed by this endpoint.'),
    ).toBeInTheDocument();
  });

  it('renders nothing when closed (id null)', () => {
    mockEntry.mockReturnValue({ isLoading: false, isError: false, data: undefined });
    renderWithProviders(<AuditDetailDrawer id={null} onClose={vi.fn()} />);
    expect(screen.queryByText('user.ban')).not.toBeInTheDocument();
  });
});
