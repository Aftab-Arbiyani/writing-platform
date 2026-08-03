import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiAvailability } from '@/hooks/use-ai-availability';
import { renderWithProviders } from '@/test/render';

import { retrievalApi } from '../api/retrieval.api';
import { AiSearchSuggestions, SearchModeToggle } from './ai-search-controls';

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

describe('SearchModeToggle', () => {
  it('announces which engine is running through aria-pressed, not styling alone', () => {
    renderWithProviders(<SearchModeToggle mode="ai" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'AI search' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Keyword' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('switches engine on click', () => {
    const onSelect = vi.fn();
    renderWithProviders(<SearchModeToggle mode="keyword" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'AI search' }));
    expect(onSelect).toHaveBeenCalledWith('ai');
  });

  /**
   * The control stays visible when AI is unavailable on purpose: hiding it makes a dark-launched
   * deployment look like a build without the feature, and the notice behind it gives the real reason.
   */
  it('renders regardless of availability — the gate decides requests, not the control', () => {
    vi.mocked(useAiAvailability).mockReturnValue('off');
    renderWithProviders(<SearchModeToggle mode="keyword" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'AI search' })).toBeInTheDocument();
  });
});

describe('AiSearchSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAiAvailability).mockReturnValue('available');
  });

  it('offers alternatives and runs the one that is picked', async () => {
    vi.mocked(retrievalApi.suggestions).mockResolvedValue(['monsoon grief', 'city rain']);
    const onPick = vi.fn();
    renderWithProviders(<AiSearchSuggestions prefix="rain" onPick={onPick} />);

    fireEvent.click(await screen.findByRole('button', { name: /monsoon grief/ }));
    expect(onPick).toHaveBeenCalledWith('monsoon grief');
  });

  it('never offers the query as an alternative to itself', async () => {
    // The query's own title is always its own best match, so the server returns it first.
    vi.mocked(retrievalApi.suggestions).mockResolvedValue(['Rain', 'monsoon grief']);
    renderWithProviders(<AiSearchSuggestions prefix="rain" onPick={vi.fn()} />);

    await screen.findByRole('button', { name: /monsoon grief/ });
    expect(screen.queryByRole('button', { name: /^Rain$/ })).not.toBeInTheDocument();
  });

  it('renders nothing at all when AI is unavailable', () => {
    vi.mocked(useAiAvailability).mockReturnValue('off');
    const { container } = renderWithProviders(
      <AiSearchSuggestions prefix="rain" onPick={vi.fn()} />,
    );
    expect(container.querySelector('nav')).toBeNull();
    expect(retrievalApi.suggestions).not.toHaveBeenCalled();
  });
});
