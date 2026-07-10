import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import type * as ExportModule from '../lib/export-analytics';
import { downloadFile } from '../lib/export-analytics';
import { ExportMenu } from './export-menu';

vi.mock('../lib/export-analytics', async () => {
  const actual = await vi.importActual<typeof ExportModule>('../lib/export-analytics');
  return { ...actual, downloadFile: vi.fn() };
});

describe('ExportMenu', () => {
  beforeEach(() => {
    vi.mocked(downloadFile).mockReset();
  });

  it('offers CSV, JSON, and Print', async () => {
    renderWithProviders(
      <ExportMenu rows={[{ metric: 'Views', value: 10 }]} json={{ views: 10 }} filenameBase="x" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Export JSON')).toBeInTheDocument();
    expect(screen.getByText('Print')).toBeInTheDocument();
  });

  it('downloads a CSV built from the rows', async () => {
    renderWithProviders(
      <ExportMenu
        rows={[{ metric: 'Views', value: 10 }]}
        json={{ views: 10 }}
        filenameBase="qalam"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(await screen.findByText('Export CSV'));
    expect(downloadFile).toHaveBeenCalledWith(
      'qalam.csv',
      expect.stringContaining('Views,10'),
      expect.stringContaining('csv'),
    );
  });

  it('downloads JSON', async () => {
    renderWithProviders(<ExportMenu rows={[]} json={{ views: 10 }} filenameBase="qalam" />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(await screen.findByText('Export JSON'));
    expect(downloadFile).toHaveBeenCalledWith(
      'qalam.json',
      expect.stringContaining('"views": 10'),
      expect.stringContaining('json'),
    );
  });
});
