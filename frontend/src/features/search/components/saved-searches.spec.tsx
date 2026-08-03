import type { SavedSearch } from '@qalam/api-types';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiAvailability } from '@/hooks/use-ai-availability';
import { renderWithProviders } from '@/test/render';

import { retrievalApi } from '../api/retrieval.api';
import { SavedSearches, SaveSearchButton } from './saved-searches';

vi.mock('@/hooks/use-ai-availability', () => ({ useAiAvailability: vi.fn() }));

vi.mock('../api/retrieval.api', () => ({
  retrievalApi: {
    features: vi.fn(),
    usage: vi.fn(),
    search: vi.fn(),
    suggestions: vi.fn(),
    savedSearches: vi.fn(),
    saveSearch: vi.fn(),
    deleteSavedSearch: vi.fn(),
    recommendations: vi.fn(),
  },
}));

const SAVED: SavedSearch = {
  id: 's1',
  name: 'Monsoon ghazals',
  query: 'rain and grief',
  queryType: null,
  storyId: null,
  createdAt: '2026-08-01T00:00:00.000Z',
};

describe('SavedSearches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAiAvailability).mockReturnValue('available');
  });

  it('lists a saved search by name, with the query it runs', async () => {
    vi.mocked(retrievalApi.savedSearches).mockResolvedValue([SAVED]);
    renderWithProviders(<SavedSearches onRun={vi.fn()} />);

    expect(await screen.findByText('Monsoon ghazals')).toBeInTheDocument();
    // The name is the owner's; the query is what it actually looks for, so both are shown.
    expect(screen.getByText('rain and grief')).toBeInTheDocument();
  });

  it('runs the saved QUERY, not its name', async () => {
    vi.mocked(retrievalApi.savedSearches).mockResolvedValue([SAVED]);
    const onRun = vi.fn();
    renderWithProviders(<SavedSearches onRun={onRun} />);

    fireEvent.click(await screen.findByText('Monsoon ghazals'));
    expect(onRun).toHaveBeenCalledWith('rain and grief');
  });

  it('removes one by id', async () => {
    vi.mocked(retrievalApi.savedSearches).mockResolvedValue([SAVED]);
    vi.mocked(retrievalApi.deleteSavedSearch).mockResolvedValue(undefined);
    renderWithProviders(<SavedSearches onRun={vi.fn()} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Remove saved search “Monsoon ghazals”' }),
    );
    await waitFor(() => {
      expect(retrievalApi.deleteSavedSearch).toHaveBeenCalledWith('s1');
    });
  });

  /**
   * Silence in both empty cases is the point: this section sits beside Recent and Trending on the
   * landing, and an empty shell there pushes the lists that DO have content below the fold.
   */
  it('renders nothing when the list is empty', async () => {
    vi.mocked(retrievalApi.savedSearches).mockResolvedValue([]);
    const { container } = renderWithProviders(<SavedSearches onRun={vi.fn()} />);

    await waitFor(() => {
      expect(retrievalApi.savedSearches).toHaveBeenCalled();
    });
    expect(container.querySelector('section')).toBeNull();
  });

  it('renders nothing and asks nothing when AI is off', async () => {
    vi.mocked(useAiAvailability).mockReturnValue('off');
    const { container } = renderWithProviders(<SavedSearches onRun={vi.fn()} />);

    expect(container.querySelector('section')).toBeNull();
    expect(retrievalApi.savedSearches).not.toHaveBeenCalled();
  });
});

describe('SaveSearchButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAiAvailability).mockReturnValue('available');
  });

  it('pre-fills the name with the query, so accepting the default is one keystroke', async () => {
    renderWithProviders(<SaveSearchButton query="rain and grief" />);

    fireEvent.click(await screen.findByRole('button', { name: /Save search/ }));
    expect(await screen.findByLabelText('Name')).toHaveValue('rain and grief');
  });

  it('saves the name the reader chose alongside the untouched query', async () => {
    vi.mocked(retrievalApi.saveSearch).mockResolvedValue(SAVED);
    renderWithProviders(<SaveSearchButton query="rain and grief" />);

    fireEvent.click(await screen.findByRole('button', { name: /Save search/ }));
    fireEvent.change(await screen.findByLabelText('Name'), {
      target: { value: 'Monsoon ghazals' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(retrievalApi.saveSearch).toHaveBeenCalledWith({
        name: 'Monsoon ghazals',
        query: 'rain and grief',
      });
    });
  });

  it('refuses to save an empty name rather than inventing one', async () => {
    renderWithProviders(<SaveSearchButton query="rain" />);

    fireEvent.click(await screen.findByRole('button', { name: /Save search/ }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('offers nothing to save when there is no query', () => {
    const { container } = renderWithProviders(<SaveSearchButton query="  " />);
    expect(container.querySelector('button')).toBeNull();
  });
});
