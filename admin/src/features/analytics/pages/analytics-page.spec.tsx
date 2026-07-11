import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { downloadAnalyticsExport } from '../api/analytics.api';
import { useAnalyticsFilters } from '../stores/analytics-filters.store';
import { AnalyticsPage } from './analytics-page';

// Stub the lazy sections so the page logic (tabs/export/print) is isolated.
vi.mock('../sections/overview-section', () => ({
  OverviewSection: () => <div>overview-content</div>,
}));
vi.mock('../sections/users-section', () => ({ UsersSection: () => <div>users-content</div> }));
vi.mock('../sections/content-section', () => ({
  ContentSection: () => <div>content-content</div>,
}));
vi.mock('../sections/engagement-section', () => ({
  EngagementSection: () => <div>engagement-content</div>,
}));
vi.mock('../sections/moderation-section', () => ({
  ModerationSection: () => <div>moderation-content</div>,
}));
vi.mock('../sections/system-section', () => ({ SystemSection: () => <div>system-content</div> }));

vi.mock('../api/analytics.api', () => ({
  downloadAnalyticsExport: vi.fn().mockResolvedValue(undefined),
}));

const mockExport = downloadAnalyticsExport as Mock;

beforeEach(() => {
  useAnalyticsFilters.getState().reset();
  window.print = vi.fn();
});
afterEach(() => vi.clearAllMocks());

describe('AnalyticsPage', () => {
  it('renders the overview section by default', async () => {
    renderWithProviders(<AnalyticsPage />);
    expect(await screen.findByText('overview-content')).toBeInTheDocument();
  });

  it('switches sections via the tabs', async () => {
    renderWithProviders(<AnalyticsPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'System' }));
    expect(await screen.findByText('system-content')).toBeInTheDocument();
  });

  it('exports the current section as CSV', async () => {
    renderWithProviders(<AnalyticsPage />);
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    fireEvent.click(await screen.findByText('Export CSV'));
    await waitFor(() =>
      expect(mockExport).toHaveBeenCalledWith(
        expect.objectContaining({ range: '30d' }),
        'overview',
        'csv',
      ),
    );
  });

  it('opens the print view', () => {
    renderWithProviders(<AnalyticsPage />);
    fireEvent.click(screen.getByRole('button', { name: /print/i }));
    expect(window.print).toHaveBeenCalled();
  });
});
