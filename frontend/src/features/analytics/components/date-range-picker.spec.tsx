import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { useAnalyticsStore } from '../stores/analytics.store';
import { DateRangePicker } from './date-range-picker';

describe('DateRangePicker', () => {
  beforeEach(() => {
    useAnalyticsStore.setState({ range: '30d' });
  });

  it('reflects the selected range from the store', () => {
    renderWithProviders(<DateRangePicker />);
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
  });

  it('updates when the range preset changes', () => {
    renderWithProviders(<DateRangePicker />);
    act(() => {
      useAnalyticsStore.getState().setRange('90d');
    });
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
  });
});
