import { SearchSort, SearchType } from '@qalam/shared';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CursorPage } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';

import { discoverApi } from '../api/discover.api';
import type { UseSearchQueryParamsResult } from '../hooks/use-search-query-params';
import { useSearchStore } from '../stores/search.store';
import { SearchFilterBar } from './search-filter-bar';

vi.mock('../api/discover.api', () => ({
  discoverApi: { languages: vi.fn(), genres: vi.fn() },
}));

const page = <T,>(items: T[]): CursorPage<T> => ({
  items,
  meta: { nextCursor: null, hasMore: false },
});

function makeParams(over: Partial<UseSearchQueryParamsResult> = {}): UseSearchQueryParamsResult {
  return {
    q: 'barish',
    hasQuery: true,
    type: SearchType.Pieces,
    sort: SearchSort.Relevance,
    language: null,
    genre: null,
    tag: null,
    readingTime: null,
    date: null,
    filters: {},
    hasActiveFilters: false,
    setQuery: vi.fn(),
    setType: vi.fn(),
    setSort: vi.fn(),
    setLanguage: vi.fn(),
    setGenre: vi.fn(),
    setTag: vi.fn(),
    setReadingTime: vi.fn(),
    setDate: vi.fn(),
    clearFilters: vi.fn(),
    ...over,
  };
}

describe('SearchFilterBar', () => {
  beforeEach(() => {
    useSearchStore.setState({ filterPanelOpen: false });
    vi.mocked(discoverApi.languages).mockResolvedValue(
      page([{ code: 'ur', nativeName: 'اردو', direction: 'rtl', pieceCount: 5 }]),
    );
    vi.mocked(discoverApi.genres).mockResolvedValue(
      page([{ slug: 'ghazal', name: 'Ghazal', pieceCount: 3 }]),
    );
  });

  it('renders the full filter set on the Pieces tab', () => {
    renderWithProviders(<SearchFilterBar params={makeParams({ type: SearchType.Pieces })} />);
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('Genre')).toBeInTheDocument();
    expect(screen.getByText('Reading time')).toBeInTheDocument();
    expect(screen.getByText('Any time')).toBeInTheDocument(); // publish-date placeholder
    expect(screen.getByText('Most relevant')).toBeInTheDocument(); // active sort value
  });

  it('limits the Writers tab to language + genre (no reading-time / sort / date)', () => {
    renderWithProviders(<SearchFilterBar params={makeParams({ type: SearchType.Writers })} />);
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('Genre')).toBeInTheDocument();
    expect(screen.queryByText('Reading time')).not.toBeInTheDocument();
    expect(screen.queryByText('Most relevant')).not.toBeInTheDocument();
  });

  it('renders no filter bar on a taxonomy tab', () => {
    renderWithProviders(<SearchFilterBar params={makeParams({ type: SearchType.Tags })} />);
    expect(screen.queryByText('Language')).not.toBeInTheDocument();
    expect(screen.queryByText('Genre')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();
  });

  /**
   * The `All` scope (W5-11, re-arranged by D5). It shows the ranked results, which accept exactly
   * what `SemanticSearchDto` accepts — so the bar renders there, and offers only those three.
   *
   * Both halves matter and they used to be one bug each: `All` rendered NO bar (so the filter
   * mapping W5-1 fixed was unreachable), and the AI engine rendered reading-time / date / sort,
   * which it silently ignored.
   */
  it('offers language + genre on the All scope, which used to show no filters at all', () => {
    renderWithProviders(<SearchFilterBar params={makeParams({ type: SearchType.All })} />);
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('Genre')).toBeInTheDocument();
  });

  it('hides the pieces-only filters on the All scope, which cannot honour them', () => {
    renderWithProviders(<SearchFilterBar params={makeParams({ type: SearchType.All })} />);
    expect(screen.queryByText('Reading time')).not.toBeInTheDocument();
    expect(screen.queryByText('Any time')).not.toBeInTheDocument();
    expect(screen.queryByText('Most relevant')).not.toBeInTheDocument();
  });

  it('clears filters when Clear is pressed', () => {
    const params = makeParams({ hasActiveFilters: true });
    renderWithProviders(<SearchFilterBar params={params} />);
    // Desktop + mobile both render a Clear affordance; either fires the same handler.
    const [clearButton] = screen.getAllByRole('button', { name: 'Clear' });
    fireEvent.click(clearButton as HTMLElement);
    expect(params.clearFilters).toHaveBeenCalled();
  });
});
