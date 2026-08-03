import type { RecommendationResponse } from '@qalam/api-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiAvailability } from '@/hooks/use-ai-availability';
import { useAuthStore } from '@/stores/auth.store';

import { readingApi } from '../api/reading.api';
import type { PieceDetail } from '../types/reading.types';
import { useRelatedPieces } from './use-related-pieces';

vi.mock('@/hooks/use-ai-availability', () => ({ useAiAvailability: vi.fn() }));

vi.mock('../api/reading.api', () => ({
  readingApi: { related: vi.fn(), recommendedFor: vi.fn() },
}));

const PIECE = {
  id: 'piece-1',
  title: 'Rain over the old city',
  tags: [
    { slug: 'rain', name: 'Rain' },
    { slug: 'city', name: 'City' },
  ],
} as unknown as PieceDetail;

function recommendation(over: Record<string, unknown> = {}): RecommendationResponse {
  return {
    kind: 'related_stories',
    items: [
      {
        id: 'piece-2',
        kind: 'related_stories',
        targetType: 'piece',
        title: 'A neighbouring piece',
        summary: '',
        object: {
          subtitle: 'On monsoon streets',
          readingTimeSeconds: 240,
          author: { username: 'meera_k', penName: 'Meera K' },
          language: { direction: 'rtl' },
        },
        score: 0.8,
        confidence: 0.8,
        reason: 'Shares tags with “Rain over the old city”: Rain, City',
        influencedBy: [],
        evidence: [],
        navigation: { kind: 'piece', ref: 'a-neighbouring-piece' },
      },
    ],
    meta: { sources: [], totalCandidates: 1, returned: 1, confidence: 0.8, degraded: false },
    ...over,
  } as unknown as RecommendationResponse;
}

/** A fresh client per test — retries off so a rejected read settles as an error immediately. */
function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const TAG_RESULT = [
  {
    id: 'piece-3',
    slug: 'from-the-tag-search',
    title: 'From the tag search',
    subtitle: null,
    readingTimeSeconds: 120,
    author: { username: 'other', penName: null },
    language: null,
  },
];

/**
 * "More like this" source selection (W1 → W5).
 *
 * The point of these is the ORDER and the fallback: a signed-in reader gets explained
 * recommendations, and everyone else keeps the tag search W1 shipped. A regression here is invisible
 * on screen — both sources render the same section — so it has to be asserted at the hook.
 */
describe('useRelatedPieces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'authenticated' });
    vi.mocked(useAiAvailability).mockReturnValue('available');
    vi.mocked(readingApi.related).mockResolvedValue(TAG_RESULT);
  });

  it('prefers the recommender for a signed-in reader, and keeps its reason', async () => {
    vi.mocked(readingApi.recommendedFor).mockResolvedValue(recommendation());

    const { result } = renderHook(() => useRelatedPieces(PIECE), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.isRecommended).toBe(true);
    });
    expect(readingApi.recommendedFor).toHaveBeenCalledWith('piece-1', expect.anything());
    expect(result.current.data?.[0]?.title).toBe('A neighbouring piece');
    expect(result.current.data?.[0]?.reason).toContain('Shares tags');
    // The slug comes from the navigation target, which is what `/p/:slug` takes.
    expect(result.current.data?.[0]?.slug).toBe('a-neighbouring-piece');
    // The fallback must not also fire — two requests for one section is waste, not resilience.
    expect(readingApi.related).not.toHaveBeenCalled();
  });

  it('never asks the recommender for a signed-out reader, and falls back to the tag search', async () => {
    useAuthStore.setState({ status: 'anonymous' });

    const { result } = renderHook(() => useRelatedPieces(PIECE), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.data?.[0]?.title).toBe('From the tag search');
    });
    expect(readingApi.recommendedFor).not.toHaveBeenCalled();
    expect(result.current.isRecommended).toBe(false);
    // The tag search cannot explain itself, and does not pretend to.
    expect(result.current.data?.[0]?.reason).toBe('');
  });

  it('falls back when the recommendations flag is down', async () => {
    vi.mocked(useAiAvailability).mockReturnValue('feature-off');

    const { result } = renderHook(() => useRelatedPieces(PIECE), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.data?.[0]?.title).toBe('From the tag search');
    });
    expect(readingApi.recommendedFor).not.toHaveBeenCalled();
  });

  it('falls back when the recommender answers with nothing', async () => {
    vi.mocked(readingApi.recommendedFor).mockResolvedValue(recommendation({ items: [] }));

    const { result } = renderHook(() => useRelatedPieces(PIECE), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.data?.[0]?.title).toBe('From the tag search');
    });
    expect(result.current.isRecommended).toBe(false);
  });

  it('falls back when the recommender fails, rather than dropping the section', async () => {
    vi.mocked(readingApi.recommendedFor).mockRejectedValue(new Error('AI_FEATURE_DISABLED'));

    const { result } = renderHook(() => useRelatedPieces(PIECE), { wrapper: wrapper() });

    await waitFor(() => {
      expect(result.current.data?.[0]?.title).toBe('From the tag search');
    });
  });

  it('drops a recommendation that points at the seed piece itself', async () => {
    vi.mocked(readingApi.recommendedFor).mockResolvedValue(
      recommendation({
        items: [
          {
            id: 'piece-1',
            kind: 'related_stories',
            targetType: 'piece',
            title: 'Rain over the old city',
            summary: '',
            object: {},
            score: 1,
            confidence: 1,
            reason: 'itself',
            influencedBy: [],
            evidence: [],
            navigation: { kind: 'piece', ref: 'rain-over-the-old-city' },
          },
        ],
      }),
    );

    const { result } = renderHook(() => useRelatedPieces(PIECE), { wrapper: wrapper() });

    // Server-side exclusion is already in place; this asserts the client does not depend on it.
    await waitFor(() => {
      expect(result.current.data?.[0]?.title).toBe('From the tag search');
    });
  });

  it('asks nothing at all before the piece has loaded', () => {
    renderHook(() => useRelatedPieces(undefined), { wrapper: wrapper() });
    expect(readingApi.recommendedFor).not.toHaveBeenCalled();
    expect(readingApi.related).not.toHaveBeenCalled();
  });
});
