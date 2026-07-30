import { Role } from '@qalam/shared';
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import { AlertsWidget } from './alerts-widget';
import { useQueues } from '../hooks/use-queues';
import { useSystemNotifications } from '../hooks/use-system-notifications';

vi.mock('../hooks/use-queues');
vi.mock('../hooks/use-system-notifications');

function mockQueues(over: Record<string, unknown>): void {
  vi.mocked(useQueues).mockReturnValue(over as unknown as ReturnType<typeof useQueues>);
}
function mockNotices(over: Record<string, unknown>): void {
  vi.mocked(useSystemNotifications).mockReturnValue(
    over as unknown as ReturnType<typeof useSystemNotifications>,
  );
}

beforeEach(() => useAuthStore.setState({ status: 'authenticated', role: Role.SuperAdmin }));
afterEach(() => {
  useAuthStore.getState().clear();
  vi.clearAllMocks();
});

describe('AlertsWidget', () => {
  it('renders alerts derived from failed jobs', () => {
    mockQueues({
      data: [
        {
          name: 'email',
          paused: false,
          counts: { waiting: 0, active: 0, completed: 0, failed: 3, delayed: 0, paused: 0 },
          oldestWaitingAgeMs: 0,
          workers: 1,
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockNotices({ data: [], isLoading: false, error: null, refetch: vi.fn() });
    renderWithProviders(<AlertsWidget />);
    expect(screen.getByText(/3 failed jobs in "email"/i)).toBeInTheDocument();
  });

  it('shows the all-clear empty state when there are no alerts', () => {
    mockQueues({ data: [], isLoading: false, error: null, refetch: vi.fn() });
    mockNotices({ data: [], isLoading: false, error: null, refetch: vi.fn() });
    renderWithProviders(<AlertsWidget />);
    expect(screen.getByText('All clear')).toBeInTheDocument();
  });
});
