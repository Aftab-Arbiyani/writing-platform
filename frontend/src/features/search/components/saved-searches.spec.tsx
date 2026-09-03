import type { SavedSearch } from '@qalam/api-types';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';

import { retrievalApi } from '../api/retrieval.api';
import { SavedSearches, SaveSearchButton } from './saved-searches';

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
    // D5: the gate is a session, not a feature flag. A saved search belongs to somebody.
    useAuthStore.setState({ status: 'authenticated' });
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

  it('renders nothing and asks NOTHING for a signed-out reader', () => {
    useAuthStore.setState({ status: 'anonymous' });
    const { container } = renderWithProviders(<SavedSearches onRun={vi.fn()} />);

    expect(container.querySelector('section')).toBeNull();
    // Not asking is the point, not merely not rendering. `/ai/search/saved` still requires a
    // session, and a 401 on the public search landing would take the api layer's `onUnauthorized()`
    // path and drop the reader's session on a page they were browsing anonymously (48 §3.25).
    expect(retrievalApi.savedSearches).not.toHaveBeenCalled();
  });
});

describe('SaveSearchButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // D5: the gate is a session, not a feature flag. A saved search belongs to somebody.
    useAuthStore.setState({ status: 'authenticated' });
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

  /**
   * The search page renders this unconditionally since D5 — the engine switch it used to hang off
   * is gone, and gating it on anything else would hide saving from every search on the page. Which
   * makes self-hiding load-bearing: this is what a signed-out reader must not see.
   */
  it('hides itself for a signed-out reader, which is what lets the page render it always', () => {
    useAuthStore.setState({ status: 'anonymous' });
    const { container } = renderWithProviders(<SaveSearchButton query="rain and grief" />);
    expect(container.querySelector('button')).toBeNull();
  });
});
