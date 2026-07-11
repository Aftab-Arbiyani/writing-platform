import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { renderWithProviders } from '@/test/render';

import {
  useCreateFeatureFlag,
  useDeleteFeatureFlag,
  useFeatureFlags,
  useUpdateFeatureFlag,
} from '../hooks/use-feature-flags';
import type { FeatureFlag } from '../types/settings.types';
import { FeatureFlagTable } from './feature-flag-table';

vi.mock('../hooks/use-feature-flags', () => ({
  useFeatureFlags: vi.fn(),
  useCreateFeatureFlag: vi.fn(),
  useUpdateFeatureFlag: vi.fn(),
  useDeleteFeatureFlag: vi.fn(),
}));

function flag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return {
    id: 'f1',
    key: 'feature.ai.enabled',
    enabled: false,
    rolloutPercentage: 0,
    environment: 'all',
    description: 'AI writing assistance',
    updatedBy: null,
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
    ...overrides,
  };
}

let toggleMutate: Mock;

beforeEach(() => {
  toggleMutate = vi.fn();
  (useFeatureFlags as Mock).mockReturnValue({
    data: [
      flag(),
      flag({ id: 'f2', key: 'feature.payments.enabled', description: 'Payments', enabled: true }),
    ],
    isLoading: false,
    isError: false,
  });
  (useUpdateFeatureFlag as Mock).mockReturnValue({ mutate: toggleMutate, isPending: false });
  (useCreateFeatureFlag as Mock).mockReturnValue({ mutate: vi.fn(), isPending: false });
  (useDeleteFeatureFlag as Mock).mockReturnValue({ mutate: vi.fn(), isPending: false });
});

afterEach(() => vi.clearAllMocks());

describe('FeatureFlagTable', () => {
  it('renders every flag', () => {
    renderWithProviders(<FeatureFlagTable />);
    expect(screen.getByText('feature.ai.enabled')).toBeInTheDocument();
    expect(screen.getByText('feature.payments.enabled')).toBeInTheDocument();
  });

  it('filters by the search term', async () => {
    renderWithProviders(<FeatureFlagTable />);
    fireEvent.change(screen.getByLabelText('Search feature flags'), {
      target: { value: 'payments' },
    });
    await waitFor(() => expect(screen.queryByText('feature.ai.enabled')).not.toBeInTheDocument());
    expect(screen.getByText('feature.payments.enabled')).toBeInTheDocument();
  });

  it('toggling a flag calls the update mutation with the new enabled state', () => {
    renderWithProviders(<FeatureFlagTable />);
    fireEvent.click(screen.getByRole('switch', { name: 'Toggle feature.ai.enabled' }));
    expect(toggleMutate.mock.calls[0]?.[0]).toEqual({ id: 'f1', payload: { enabled: true } });
  });

  it('opens the create dialog from the New flag button', async () => {
    renderWithProviders(<FeatureFlagTable />);
    fireEvent.click(screen.getByRole('button', { name: /new flag/i }));
    expect(await screen.findByText('New feature flag')).toBeInTheDocument();
  });

  it('shows an empty state when there are no flags', () => {
    (useFeatureFlags as Mock).mockReturnValue({ data: [], isLoading: false, isError: false });
    renderWithProviders(<FeatureFlagTable />);
    expect(screen.getByText('No feature flags')).toBeInTheDocument();
  });
});
