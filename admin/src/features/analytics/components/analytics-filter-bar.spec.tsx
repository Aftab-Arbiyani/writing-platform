import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { useAnalyticsFilters } from '../stores/analytics-filters.store';
import { AnalyticsFilterBar } from './analytics-filter-bar';

afterEach(() => {
  useAnalyticsFilters.getState().reset();
  vi.clearAllMocks();
});

function renderBar(overrides: Partial<Parameters<typeof AnalyticsFilterBar>[0]> = {}) {
  const props = {
    onExport: vi.fn(),
    exporting: false,
    onPrint: vi.fn(),
    onRefresh: vi.fn(),
    refreshing: false,
    ...overrides,
  };
  renderWithProviders(<AnalyticsFilterBar {...props} />);
  return props;
}

describe('AnalyticsFilterBar', () => {
  it('exports as CSV from the export menu', async () => {
    const props = renderBar();
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    fireEvent.click(await screen.findByText('Export CSV'));
    expect(props.onExport).toHaveBeenCalledWith('csv');
  });

  it('exports as JSON', async () => {
    const props = renderBar();
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    fireEvent.click(await screen.findByText('Export JSON'));
    expect(props.onExport).toHaveBeenCalledWith('json');
  });

  it('triggers print and refresh', () => {
    const props = renderBar();
    fireEvent.click(screen.getByRole('button', { name: /print/i }));
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(props.onPrint).toHaveBeenCalled();
    expect(props.onRefresh).toHaveBeenCalled();
  });

  it('reflects the persisted range and shows custom date inputs', () => {
    useAnalyticsFilters.setState({ range: 'custom', from: '2026-01-01T00:00:00.000Z' });
    renderBar();
    expect(screen.getByLabelText('From date')).toBeInTheDocument();
    expect(screen.getByLabelText('To date')).toBeInTheDocument();
  });
});
