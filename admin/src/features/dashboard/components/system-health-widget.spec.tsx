import { Role } from '@qalam/shared';
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import { SystemHealthWidget } from './system-health-widget';
import { useQueues } from '../hooks/use-queues';
import { useSystemHealth } from '../hooks/use-system-health';

vi.mock('../hooks/use-system-health');
vi.mock('../hooks/use-queues');

beforeEach(() => useAuthStore.setState({ status: 'authenticated', role: Role.SuperAdmin }));
afterEach(() => {
  useAuthStore.getState().clear();
  vi.clearAllMocks();
});

describe('SystemHealthWidget', () => {
  it('renders a tile per service with its status', () => {
    vi.mocked(useSystemHealth).mockReturnValue({
      data: {
        api: 'healthy',
        database: 'healthy',
        redis: 'warning',
        queues: 'healthy',
        storage: 'critical',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSystemHealth>);
    vi.mocked(useQueues).mockReturnValue({
      data: [
        {
          name: 'email',
          paused: false,
          counts: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
          oldestWaitingAgeMs: 0,
          workers: 2,
        },
      ],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useQueues>);

    renderWithProviders(<SystemHealthWidget />);

    expect(screen.getByText('API')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('Workers')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument(); // storage
    expect(screen.getByText('Warning')).toBeInTheDocument(); // redis
  });
});
