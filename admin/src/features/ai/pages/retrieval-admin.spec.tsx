import type { RetrievalAdminConfig, SearchAnalytics } from '@qalam/api-types';
import {
  RankingSignal,
  RetrievalFailureReason,
  RetrievalIntent,
  RetrievalQueryType,
  RetrievalSource,
  Role,
} from '@qalam/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';

import { SearchAnalyticsPage } from './search-analytics-page';
import { SearchConfigPage } from './search-config-page';

/**
 * The two A3 surfaces, each in the states the row requires: loading, populated, errored, plus the
 * ones that carry a claim about the data — an EMPTY analytics window and a TRUNCATED one.
 *
 * Two assertions here are the row's real content rather than coverage:
 *
 * - the config form submits the FULL snapshot it was loaded with, so an untouched weight cannot be
 *   dropped by a partial patch;
 * - a truncated window says so. The server caps its aggregation, and before A3 nothing in the
 *   response revealed it, so this page would have presented the newest slice as the whole window.
 */
vi.mock('../api/ai.api');

const { aiApi } = await import('../api/ai.api');
const searchConfig = vi.mocked(aiApi.searchConfig);
const updateSearchConfig = vi.mocked(aiApi.updateSearchConfig);
const searchAnalytics = vi.mocked(aiApi.searchAnalytics);

const CONFIG: RetrievalAdminConfig = {
  topK: 10,
  candidatesPerSource: 40,
  contextTokens: 2000,
  timeoutMs: 8000,
  sources: {
    [RetrievalSource.KnowledgeGraph]: true,
    [RetrievalSource.Metadata]: true,
    [RetrievalSource.Keyword]: true,
    [RetrievalSource.Vector]: false,
  },
  rankingWeights: {
    [RankingSignal.SemanticSimilarity]: 1,
    [RankingSignal.GraphDistance]: 0.5,
    [RankingSignal.Popularity]: 0.3,
    [RankingSignal.Freshness]: 0.2,
    [RankingSignal.UserPreferences]: 0.4,
    [RankingSignal.ReadingHistory]: 0.3,
    [RankingSignal.WritingHistory]: 0.3,
    [RankingSignal.Engagement]: 0.3,
    [RankingSignal.Confidence]: 0.6,
  },
  synthesisEnabled: true,
};

/** A young install: a complete response whose every figure is a true zero. */
const EMPTY_ANALYTICS: SearchAnalytics = {
  window: '7d',
  totalQueries: 0,
  truncated: false,
  byIntent: [],
  byQueryType: [],
  zeroResultRate: 0,
  avgLatencyMs: 0,
  p95LatencyMs: 0,
  avgConfidence: 0,
  cacheHitRatio: 0,
  avgContextTokens: 0,
  failureBreakdown: [],
};

const ANALYTICS: SearchAnalytics = {
  window: '7d',
  totalQueries: 400,
  truncated: false,
  byIntent: [
    { intent: RetrievalIntent.Search, count: 300 },
    { intent: RetrievalIntent.Ask, count: 100 },
  ],
  byQueryType: [
    { queryType: RetrievalQueryType.NaturalLanguage, count: 320 },
    { queryType: RetrievalQueryType.Character, count: 80 },
  ],
  zeroResultRate: 0.05,
  avgLatencyMs: 412,
  p95LatencyMs: 1290,
  avgConfidence: 0.72,
  cacheHitRatio: 0.4,
  avgContextTokens: 1180,
  failureBreakdown: [{ reason: RetrievalFailureReason.Timeout, count: 3 }],
};

function apiError(): ApiError {
  return new ApiError(500, {
    code: 'INTERNAL_ERROR',
    message: 'boom',
    details: [],
    requestId: 'req-42',
  });
}

/** A promise that never settles — the first-load state. */
function pending<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Both reads are gated on `ai.manage` through `enabled`, so a test without the grant would see a
  // query that never fires rather than the page under test.
  useAuthStore.setState({ status: 'authenticated', role: Role.Admin });
});

afterEach(() => useAuthStore.getState().clear());

describe('SearchConfigPage', () => {
  it('shows a skeleton while the first read is in flight', () => {
    searchConfig.mockReturnValue(pending<RetrievalAdminConfig>());
    renderWithProviders(<SearchConfigPage />);

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('renders the stored config, including a source that is off', async () => {
    searchConfig.mockResolvedValue(CONFIG);
    renderWithProviders(<SearchConfigPage />);

    expect(await screen.findByLabelText('Results per request')).toHaveDisplayValue('10');
    expect(screen.getByLabelText('Retrieval timeout in milliseconds')).toHaveDisplayValue('8000');
    expect(screen.getByLabelText('Knowledge graph')).toBeChecked();
    expect(screen.getByLabelText('Vector')).not.toBeChecked();
    // A 0.05 step gives the weight inputs two decimal places, so weights read as 0.30 / 1.00 —
    // deliberate: it makes a column of them comparable at a glance.
    expect(screen.getByLabelText('Semantic similarity weight')).toHaveDisplayValue('1.00');
    expect(screen.getByLabelText('Freshness weight')).toHaveDisplayValue('0.20');
  });

  it('says the vector source is inert, so nobody expects a toggle to do something', async () => {
    searchConfig.mockResolvedValue(CONFIG);
    renderWithProviders(<SearchConfigPage />);

    expect(await screen.findByText(/reserved extension point/i)).toBeInTheDocument();
  });

  it('states that a weight of 0 disables its signal', async () => {
    searchConfig.mockResolvedValue(CONFIG);
    renderWithProviders(<SearchConfigPage />);

    expect(await screen.findByText(/0 removes the signal from ranking/i)).toBeInTheDocument();
  });

  it('submits the whole snapshot, so an untouched weight cannot be dropped', async () => {
    searchConfig.mockResolvedValue(CONFIG);
    updateSearchConfig.mockResolvedValue({ ...CONFIG, topK: 12 });
    renderWithProviders(<SearchConfigPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Save config' }));

    await waitFor(() => expect(updateSearchConfig).toHaveBeenCalledTimes(1));
    const payload = updateSearchConfig.mock.calls[0]?.[0];
    expect(payload).toEqual(CONFIG);
    expect(Object.keys(payload?.rankingWeights ?? {})).toHaveLength(
      Object.values(RankingSignal).length,
    );
    expect(Object.keys(payload?.sources ?? {})).toHaveLength(Object.values(RetrievalSource).length);
  });

  it('sends an edited budget with the rest of the snapshot intact', async () => {
    searchConfig.mockResolvedValue(CONFIG);
    updateSearchConfig.mockResolvedValue(CONFIG);
    renderWithProviders(<SearchConfigPage />);

    const topK = await screen.findByLabelText('Results per request');
    fireEvent.change(topK, { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save config' }));

    await waitFor(() => expect(updateSearchConfig).toHaveBeenCalledTimes(1));
    expect(updateSearchConfig.mock.calls[0]?.[0]).toEqual({ ...CONFIG, topK: 25 });
  });

  it('shows the house error panel with a retry instead of an empty form', async () => {
    searchConfig.mockRejectedValue(apiError());
    renderWithProviders(<SearchConfigPage />);

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Results per request')).not.toBeInTheDocument();
  });

  it('refuses the surface to an operator without ai.manage', () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Moderator });
    renderWithProviders(<SearchConfigPage />);

    expect(screen.getByRole('heading', { name: /have access/i })).toBeInTheDocument();
    expect(searchConfig).not.toHaveBeenCalled();
  });
});

describe('SearchAnalyticsPage', () => {
  it('shows a skeleton while the first read is in flight', () => {
    searchAnalytics.mockReturnValue(pending<SearchAnalytics>());
    renderWithProviders(<SearchAnalyticsPage />);

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('withholds every figure on an empty window rather than rendering zeroes', async () => {
    searchAnalytics.mockResolvedValue(EMPTY_ANALYTICS);
    renderWithProviders(<SearchAnalyticsPage />);

    expect(await screen.findByText(/No AI retrieval requests in this window/i)).toBeInTheDocument();
    expect(screen.queryByText('Zero-result rate')).not.toBeInTheDocument();
    expect(screen.queryByText('p95 latency')).not.toBeInTheDocument();
  });

  it('renders the quality signals and the breakdowns', async () => {
    searchAnalytics.mockResolvedValue(ANALYTICS);
    renderWithProviders(<SearchAnalyticsPage />);

    expect(await screen.findByText('400')).toBeInTheDocument();
    expect(screen.getByText('5.0%')).toBeInTheDocument();
    expect(screen.getByText('0.72')).toBeInTheDocument();
    expect(screen.getByText('412 ms')).toBeInTheDocument();
    expect(screen.getByText('1,290 ms')).toBeInTheDocument();
    expect(screen.getByText('Ask My Book')).toBeInTheDocument();
    expect(screen.getByText('Natural language')).toBeInTheDocument();
    expect(screen.getByText('Timed out')).toBeInTheDocument();
  });

  it('reports avgConfidence on its real scale, not rounded to 0 or 1', async () => {
    // The defect this row fixed server-side: `avgConfidence` shared the integer mean used for
    // milliseconds, so 0.72 arrived as 1. The page prints two decimals, which only means something
    // because the contract now carries them.
    searchAnalytics.mockResolvedValue(ANALYTICS);
    renderWithProviders(<SearchAnalyticsPage />);

    expect(await screen.findByText('0.72')).toBeInTheDocument();
    expect(screen.queryByText('1.00')).not.toBeInTheDocument();
  });

  it('labels a truncated window as a sample of it', async () => {
    searchAnalytics.mockResolvedValue({ ...ANALYTICS, totalQueries: 5000, truncated: true });
    renderWithProviders(<SearchAnalyticsPage />);

    expect(await screen.findByText(/a sample, not the whole window/i)).toBeInTheDocument();
    expect(screen.getByText(/most recent 5,000 requests/i)).toBeInTheDocument();
  });

  it('says nothing about truncation when the window fits', async () => {
    searchAnalytics.mockResolvedValue(ANALYTICS);
    renderWithProviders(<SearchAnalyticsPage />);

    await screen.findByText('400');
    expect(screen.queryByText(/a sample, not the whole window/i)).not.toBeInTheDocument();
  });

  it('reads the default 7-day window first, and refetches when the window changes', async () => {
    searchAnalytics.mockResolvedValue(ANALYTICS);
    renderWithProviders(<SearchAnalyticsPage />);

    await waitFor(() => expect(searchAnalytics).toHaveBeenCalledWith(7, expect.anything()));

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Analytics window' }));
    fireEvent.click(await screen.findByText('Last 30 days'));

    await waitFor(() => expect(searchAnalytics).toHaveBeenCalledWith(30, expect.anything()));
  });

  it('says a completed window had no failures instead of leaving the card blank', async () => {
    searchAnalytics.mockResolvedValue({ ...ANALYTICS, failureBreakdown: [] });
    renderWithProviders(<SearchAnalyticsPage />);

    expect(await screen.findByText(/every request completed/i)).toBeInTheDocument();
  });

  it('shows the house error panel with a retry, and no fabricated figures', async () => {
    searchAnalytics.mockRejectedValue(apiError());
    renderWithProviders(<SearchAnalyticsPage />);

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('Zero-result rate')).not.toBeInTheDocument();
  });

  it('refuses the surface to an operator without ai.manage', () => {
    useAuthStore.setState({ status: 'authenticated', role: Role.Moderator });
    renderWithProviders(<SearchAnalyticsPage />);

    expect(screen.getByRole('heading', { name: /have access/i })).toBeInTheDocument();
    expect(searchAnalytics).not.toHaveBeenCalled();
  });
});
