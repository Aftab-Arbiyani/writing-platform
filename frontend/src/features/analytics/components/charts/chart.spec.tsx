import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Chart } from './chart';

// Stub the echarts engine — tests assert the accessible data table, not the canvas.
vi.mock('./chart-core', () => ({
  createChart: () => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }),
}));

const table = {
  caption: 'Views over time',
  columns: ['Date', 'Views'],
  rows: [
    ['Mon', 10],
    ['Tue', 20],
  ],
};

describe('Chart', () => {
  it('renders an accessible data table beside the chart (accessible charts)', () => {
    render(<Chart option={{}} ariaLabel="Views chart" table={table} />);
    expect(screen.getByRole('table', { name: 'Views over time' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Tue' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Views chart' })).toBeInTheDocument();
  });

  it('renders a loading skeleton (no chart/table yet)', () => {
    render(<Chart option={{}} ariaLabel="Views" table={table} loading />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders an empty message + still exposes the data table', () => {
    render(
      <Chart option={{}} ariaLabel="Views" table={table} isEmpty emptyMessage="No data yet." />,
    );
    expect(screen.getByText('No data yet.')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Views over time' })).toBeInTheDocument();
  });

  it('omits the table + name when decorative (sparkline)', () => {
    render(<Chart option={{}} ariaLabel="" table={table} decorative />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
