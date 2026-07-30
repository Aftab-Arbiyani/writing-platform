import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { ChartContainer } from './chart-container';

describe('ChartContainer', () => {
  it('renders the chart + an sr-only data table when it has data', () => {
    renderWithProviders(
      <ChartContainer
        title="Registrations"
        table={{ columns: ['Date', 'Count'], rows: [['2026-07-10', 5]] }}
      >
        <div data-testid="chart">chart</div>
      </ChartContainer>,
    );
    expect(screen.getByTestId('chart')).toBeInTheDocument();
    // Accessible table mirror.
    expect(screen.getByRole('table', { name: 'Registrations' })).toBeInTheDocument();
    expect(screen.getByText('2026-07-10')).toBeInTheDocument();
  });

  it('shows a skeleton while loading (no chart)', () => {
    renderWithProviders(
      <ChartContainer title="X" loading>
        <div data-testid="chart" />
      </ChartContainer>,
    );
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
  });

  it('shows an empty state', () => {
    renderWithProviders(
      <ChartContainer title="X" isEmpty>
        <div data-testid="chart" />
      </ChartContainer>,
    );
    expect(screen.getByText('No data for this range')).toBeInTheDocument();
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
  });

  it('shows an error with a retry', () => {
    renderWithProviders(
      <ChartContainer title="X" error={new Error('boom')} onRetry={() => undefined}>
        <div data-testid="chart" />
      </ChartContainer>,
    );
    expect(screen.getByText('Couldn’t load this chart')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
