import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { useSystemAnalytics } from '../hooks/use-analytics';
import type { SystemAnalytics } from '../types/analytics.types';
import { SystemSection } from './system-section';

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

vi.mock('../hooks/use-analytics', () => ({ useSystemAnalytics: vi.fn() }));

function system(overrides: Partial<SystemAnalytics> = {}): SystemAnalytics {
  return {
    apiRequests: null,
    errorRate: null,
    queues: [
      { name: 'analytics-rollup', waiting: 2, active: 1, completed: 9, failed: 0, delayed: 0 },
    ],
    activeWorkers: 1,
    workersEnabled: true,
    cacheHitRatio: 0.92,
    cacheKeys: 120,
    cacheMemoryBytes: 2097152,
    databaseSizeBytes: 14531607,
    topTables: [{ table: 'notifications', bytes: 1507328 }],
    storageNote: 'Object storage (MinIO) usage is not tracked.',
    ...overrides,
  };
}

afterEach(() => vi.clearAllMocks());

describe('SystemSection', () => {
  it('renders health, cache hit rate, queue table, and API-metrics degradation', () => {
    (useSystemAnalytics as Mock).mockReturnValue({
      data: system(),
      isLoading: false,
      isError: false,
    });
    renderWithProviders(<SystemSection />);

    expect(screen.getByText('Connected')).toBeInTheDocument(); // Redis up
    expect(screen.getByText('92.0%')).toBeInTheDocument(); // cache hit rate
    expect(screen.getByText('analytics-rollup')).toBeInTheDocument(); // queue row
    expect(screen.getByText('API requests')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0); // per-node metrics degraded
    expect(screen.getByText(/Object storage/)).toBeInTheDocument();
  });

  it('marks Redis unavailable when the hit ratio is null', () => {
    (useSystemAnalytics as Mock).mockReturnValue({
      data: system({ cacheHitRatio: null, cacheKeys: null, cacheMemoryBytes: null }),
      isLoading: false,
      isError: false,
    });
    renderWithProviders(<SystemSection />);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });
});
