import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { retrievalApi } from '../api/retrieval.api';
import { SearchSuggestions } from './search-suggestions';

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

/**
 * D5 deleted this file's other subject, `SearchModeToggle` — the two-button engine switch. It is not
 * replaced by anything: the question it asked ("keyword or AI?") is one a reader had no way to
 * answer, and there is one engine now.
 */
describe('SearchSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers alternatives and runs the one that is picked', async () => {
    vi.mocked(retrievalApi.suggestions).mockResolvedValue(['monsoon grief', 'city rain']);
    const onPick = vi.fn();
    renderWithProviders(<SearchSuggestions prefix="rain" onPick={onPick} />);

    fireEvent.click(await screen.findByRole('button', { name: /monsoon grief/ }));
    expect(onPick).toHaveBeenCalledWith('monsoon grief');
  });

  it('never offers the query as an alternative to itself', async () => {
    // The query's own title is always its own best match, so the server returns it first.
    vi.mocked(retrievalApi.suggestions).mockResolvedValue(['Rain', 'monsoon grief']);
    renderWithProviders(<SearchSuggestions prefix="rain" onPick={vi.fn()} />);

    await screen.findByRole('button', { name: /monsoon grief/ });
    expect(screen.queryByRole('button', { name: /^Rain$/ })).not.toBeInTheDocument();
  });

  it('asks for suggestions without waiting for a feature gate', async () => {
    vi.mocked(retrievalApi.suggestions).mockResolvedValue(['monsoon grief']);
    renderWithProviders(<SearchSuggestions prefix="rain" onPick={vi.fn()} />);

    // The route is public since D5. It used to be gated on `semantic_search` availability, which on
    // a stock deployment (every AI flag seeded off) meant it never asked at all.
    await screen.findByRole('button', { name: /monsoon grief/ });
    expect(retrievalApi.suggestions).toHaveBeenCalled();
  });

  it('renders nothing when there is nothing to suggest', async () => {
    vi.mocked(retrievalApi.suggestions).mockResolvedValue([]);
    const { container } = renderWithProviders(<SearchSuggestions prefix="rain" onPick={vi.fn()} />);

    await vi.waitFor(() => {
      expect(retrievalApi.suggestions).toHaveBeenCalled();
    });
    expect(container.querySelector('nav')).toBeNull();
  });
});
