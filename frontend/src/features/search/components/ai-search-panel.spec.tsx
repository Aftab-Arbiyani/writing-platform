import { RetrievalIntent, RetrievalQueryType, RetrievalSource } from '@qalam/shared';
import type { SearchResultItem, SemanticSearchResponse } from '@qalam/api-types';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiAvailability } from '@/hooks/use-ai-availability';
import { renderWithProviders } from '@/test/render';

import { retrievalApi } from '../api/retrieval.api';
import type { UseSearchQueryParamsResult } from '../hooks/use-search-query-params';
import { AiSearchPanel } from './ai-search-panel';

// The gate is app-level (one read shared by every AI surface), so the availability it resolves is
// the input to this component — stubbed directly rather than reconstructed from two payloads.
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
    mode: 'ai',
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
    setMode: vi.fn(),
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
 * The AI search surface (W5/AF4).
 *
 * The gating cases come first because they are the majority state: AF1 seeds every AI flag disabled,
 * so on a stock deployment this panel's whole job is to explain itself rather than to render results.
 */
describe('AiSearchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAiAvailability).mockReturnValue('available');
  });

  it('explains itself and asks for NOTHING when the master AI flag is down', async () => {
    vi.mocked(useAiAvailability).mockReturnValue('off');
    renderWithProviders(<AiSearchPanel params={params()} />);

    expect(await screen.findByText('AI is turned off')).toBeInTheDocument();
    // The gate is what decides whether a request happens — a dark deployment must not spend a
    // rate-limited call to be told what its own flags already said.
    expect(retrievalApi.search).not.toHaveBeenCalled();
  });

  it('distinguishes "this feature is off" from "AI is off"', async () => {
    vi.mocked(useAiAvailability).mockReturnValue('feature-off');
    renderWithProviders(<AiSearchPanel params={params()} />);

    expect(await screen.findByText('Not available yet')).toBeInTheDocument();
    expect(retrievalApi.search).not.toHaveBeenCalled();
  });

  it('renders ranked results with their reason, related entities and evidence', async () => {
    vi.mocked(retrievalApi.search).mockResolvedValue(response());
    renderWithProviders(<AiSearchPanel params={params()} />);

    expect(await screen.findByText('Rain over the old city')).toBeInTheDocument();
    // A result must explain itself — that is the platform's design law, not a nicety.
    expect(screen.getByText(/Matches your query strongly/)).toBeInTheDocument();
    expect(screen.getByLabelText('Evidence')).toBeInTheDocument();
    expect(screen.getByLabelText('Related')).toBeInTheDocument();
  });

  it('sends the row filters as flat fields, with the tag as `tags` (W5-1)', async () => {
    vi.mocked(retrievalApi.search).mockResolvedValue(response());
    renderWithProviders(
      <AiSearchPanel params={params({ language: 'ur', genre: 'ghazal', tag: 'rain' })} />,
    );

    await screen.findByText('Rain over the old city');
    expect(retrievalApi.search).toHaveBeenCalledWith(
      { query: 'rain', language: 'ur', genre: 'ghazal', tags: 'rain' },
      expect.anything(),
    );
  });

  it('does not ask for a synthesised answer until the reader asks for one', async () => {
    vi.mocked(retrievalApi.search).mockResolvedValue(response());
    renderWithProviders(<AiSearchPanel params={params()} />);

    await screen.findByText('Rain over the old city');
    // Synthesis is the only part of search that spends tokens and meters against the allowance.
    const body = vi.mocked(retrievalApi.search).mock.calls[0]?.[0];
    expect(body).not.toHaveProperty('synthesize');
    expect(screen.getByRole('button', { name: /Explain these results/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
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
    renderWithProviders(<AiSearchPanel params={params()} />);

    // A partial answer that looks complete is this platform's most dangerous failure mode: a source
    // can time out and the request still succeeds.
    expect(await screen.findByText(/some sources were unavailable/)).toBeInTheDocument();
  });

  it('renders the answer when one comes back', async () => {
    vi.mocked(retrievalApi.search).mockResolvedValue(
      response({ answer: 'Three pieces touch on monsoon grief.' }),
    );
    renderWithProviders(<AiSearchPanel params={params()} />);

    expect(await screen.findByText('Three pieces touch on monsoon grief.')).toBeInTheDocument();
  });

  it('offers keyword search as the way out when retrieval fails', async () => {
    vi.mocked(retrievalApi.search).mockRejectedValue(new Error('retrieval failed'));
    renderWithProviders(<AiSearchPanel params={params()} />);

    expect(await screen.findByText('AI search didn’t finish')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use keyword search' })).toBeInTheDocument();
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
    renderWithProviders(<AiSearchPanel params={params()} />);

    expect(await screen.findByText('Nothing found')).toBeInTheDocument();
  });
});
