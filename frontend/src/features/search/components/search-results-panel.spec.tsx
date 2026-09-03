import { RetrievalIntent, RetrievalQueryType, RetrievalSource } from '@qalam/shared';
import type { SearchResultItem, SemanticSearchResponse } from '@qalam/api-types';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { retrievalApi } from '../api/retrieval.api';
import type { UseSearchQueryParamsResult } from '../hooks/use-search-query-params';
import { SearchResultsPanel } from './search-results-panel';

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
 * The keyword lists stand in for themselves. The claim under test is "on a ranking failure this
 * renders the keyword results", which is about the fallback DECISION; mounting the real list would
 * drag in five infinite queries and test their loading states instead.
 */
vi.mock('./search-results', () => ({
  SearchResults: () => <div data-testid="keyword-results" />,
}));

function result(over: Partial<SearchResultItem> = {}): SearchResultItem {
  return {
    id: 'p1',
    type: 'piece',
    sourceType: RetrievalSource.Keyword,
    title: 'Rain over the old city',
    summary: 'A ghazal about a monsoon evening.',
    object: {},
    confidence: 0.8,
    relevanceScore: 0.75,
    evidence: [
      {
        source: RetrievalSource.Keyword,
        ref: 'p1',
        label: 'Rain',
        quote: 'the rain fell',
        score: 0.7,
      },
    ],
    relatedEntities: [{ id: 'rain', type: 'tag', name: 'Rain', relation: 'shared tag' }],
    navigation: { kind: 'piece', ref: 'rain-over-the-old-city' },
    reason: 'Matches your query strongly',
    ranking: { score: 0.75, signals: [], summary: 'high name match' },
    ...over,
  };
}

function response(over: Partial<SemanticSearchResponse> = {}): SemanticSearchResponse {
  return {
    query: 'rain',
    intent: RetrievalIntent.Search,
    queryType: RetrievalQueryType.NaturalLanguage,
    answer: null,
    results: [result()],
    evidence: [],
    meta: {
      sources: [RetrievalSource.Keyword],
      totalCandidates: 12,
      returned: 1,
      confidence: 0.8,
      degraded: false,
    },
    ...over,
  };
}

function params(over: Partial<UseSearchQueryParamsResult> = {}): UseSearchQueryParamsResult {
  return {
    q: 'rain',
    hasQuery: true,
    type: 'all',
    sort: 'relevance',
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
  } as unknown as UseSearchQueryParamsResult;
}

/**
 * The default search results.
 *
 * D5 deleted this file's largest describe block — the gating cases. There used to be four ways for
 * this panel to render an explanation instead of results (AI off / feature off / no allowance / no
 * plan), and on a stock deployment explaining itself was its whole job, because AF1 seeds every AI
 * flag disabled. The route is public now and calls no model, so a reader searches and gets results.
 * What is left to test is the search.
 */
describe('SearchResultsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches without waiting for any feature gate', async () => {
    vi.mocked(retrievalApi.search).mockResolvedValue(response());
    renderWithProviders(<SearchResultsPanel params={params()} />);

    expect(await screen.findByText('Rain over the old city')).toBeInTheDocument();
    expect(retrievalApi.search).toHaveBeenCalledTimes(1);
  });

  it('renders ranked results with their reason, related entities and evidence', async () => {
    vi.mocked(retrievalApi.search).mockResolvedValue(response());
    renderWithProviders(<SearchResultsPanel params={params()} />);

    expect(await screen.findByText('Rain over the old city')).toBeInTheDocument();
    // A result must explain itself — that is the platform's design law, not a nicety.
    expect(screen.getByText(/Matches your query strongly/)).toBeInTheDocument();
    expect(screen.getByLabelText('Evidence')).toBeInTheDocument();
    expect(screen.getByLabelText('Related')).toBeInTheDocument();
  });

  it('sends the row filters as flat fields, with the tag as `tags` (W5-1)', async () => {
    vi.mocked(retrievalApi.search).mockResolvedValue(response());
    renderWithProviders(
      <SearchResultsPanel params={params({ language: 'ur', genre: 'ghazal', tag: 'rain' })} />,
    );

    await screen.findByText('Rain over the old city');
    expect(retrievalApi.search).toHaveBeenCalledWith(
      { query: 'rain', language: 'ur', genre: 'ghazal', tags: 'rain' },
      expect.anything(),
    );
  });

  it('never asks for a synthesised answer', async () => {
    vi.mocked(retrievalApi.search).mockResolvedValue(response());
    renderWithProviders(<SearchResultsPanel params={params()} />);

    await screen.findByText('Rain over the old city');
    // The one part of search that ever reached a model. The server ignores the field and V deletes
    // it; until then, not sending it is what keeps this off the AI platform entirely.
    const body = vi.mocked(retrievalApi.search).mock.calls[0]?.[0];
    expect(body).not.toHaveProperty('synthesize');
  });

  it('renders no answer block even if the server still sends one', async () => {
    vi.mocked(retrievalApi.search).mockResolvedValue(
      response({ answer: 'Three pieces touch on monsoon grief.' }),
    );
    renderWithProviders(<SearchResultsPanel params={params()} />);

    await screen.findByText('Rain over the old city');
    // `answer` is pinned to null server-side and leaves the wire in V. A client that still rendered
    // it would resurrect the one AI-authored thing on this page the moment anything wrote to it.
    expect(screen.queryByText('Three pieces touch on monsoon grief.')).not.toBeInTheDocument();
  });

  it('says so when the server reports a degraded run', async () => {
    vi.mocked(retrievalApi.search).mockResolvedValue(
      response({
        meta: {
          sources: [RetrievalSource.Keyword],
          totalCandidates: 3,
          returned: 1,
          confidence: 0.4,
          degraded: true,
        },
      }),
    );
    renderWithProviders(<SearchResultsPanel params={params()} />);

    // A partial answer that looks complete is this platform's most dangerous failure mode: a source
    // can time out and the request still succeeds.
    expect(await screen.findByText(/some sources were unavailable/)).toBeInTheDocument();
  });

  it('falls back to the keyword results when ranking fails, without an error', async () => {
    vi.mocked(retrievalApi.search).mockRejectedValue(new Error('retrieval failed'));
    renderWithProviders(<SearchResultsPanel params={params()} />);

    // The reader asked for search, not for the ranker. Before D5 they were told their chosen engine
    // failed, which was right when choosing was theirs to do; now it would report an implementation
    // detail they never picked.
    expect(await screen.findByTestId('keyword-results')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search results')).not.toBeInTheDocument();
  });

  it('answers an empty result set as "nothing found", not as an error', async () => {
    vi.mocked(retrievalApi.search).mockResolvedValue(
      response({
        results: [],
        meta: {
          sources: [RetrievalSource.Keyword],
          totalCandidates: 0,
          returned: 0,
          confidence: 0,
          degraded: false,
        },
      }),
    );
    renderWithProviders(<SearchResultsPanel params={params()} />);

    expect(await screen.findByText('Nothing found')).toBeInTheDocument();
  });
});
