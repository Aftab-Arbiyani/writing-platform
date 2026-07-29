import { ERROR_CODES, ReviewState } from '@qalam/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

import { publishingApi } from '../api/publishing.api';
import type { ReviewSession } from '../types/collaboration.types';
import { isNotApproved, useReviewActions, useStoryReview } from './use-review';

vi.mock('../api/publishing.api');

const review = vi.mocked(publishingApi.review);
const approve = vi.mocked(publishingApi.approveReview);

const STORY = 'story-1';

function session(): ReviewSession {
  return {
    id: 'rev-1',
    storyId: STORY,
    requestedById: 'user-1',
    state: ReviewState.InReview,
    reviewerId: null,
    decision: null,
    notes: null,
    submittedAt: new Date().toISOString(),
    decidedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
  return { client, invalidate, wrapper };
}

/**
 * The nullable review read (defect **P-4**, `qalam-mobile/docs/56` §2.2).
 *
 * `GET /stories/:id/review` answers a 200 carrying `{data: null}` for a story that has never been
 * submitted — which is EVERY story before the flow starts. Mobile's client raised
 * `API_MALFORMED_RESPONSE` on that body, so the default state of every story surfaced as an error and
 * the review card could never read "Draft".
 *
 * Web's `api-client` passes `data` through untouched, so the equivalent fix is the honest type plus
 * these tests: `null` must reach the caller as data, never as an error, and must be cached as such.
 */
describe('useStoryReview — a story with no session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves null as DATA, not as an error', async () => {
    review.mockResolvedValue(null);
    const { wrapper } = setup();

    const { result } = renderHook(() => useStoryReview(STORY), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
    // The distinction that matters: `undefined` would mean "nothing loaded yet", and React Query
    // rejects it as a query result. `null` means "loaded, and there is no session".
    expect(result.current.data).not.toBeUndefined();
  });

  it('caches the null so a second reader does not refetch', async () => {
    review.mockResolvedValue(null);
    const { wrapper } = setup();

    const { result } = renderHook(() => useStoryReview(STORY), { wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    renderHook(() => useStoryReview(STORY), { wrapper });

    expect(review).toHaveBeenCalledTimes(1);
  });

  it('still surfaces a real failure as an error', async () => {
    review.mockRejectedValue(new ApiError(500, { code: 'API_UNEXPECTED_ERROR', message: 'boom' }));
    const { wrapper } = setup();

    const { result } = renderHook(() => useStoryReview(STORY), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('does not fire at all without a story id', () => {
    const { wrapper } = setup();
    renderHook(() => useStoryReview(undefined), { wrapper });
    expect(review).not.toHaveBeenCalled();
  });
});

describe('useReviewActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    approve.mockResolvedValue(session());
  });

  it('approving invalidates the CAPABILITY map, not just the review', async () => {
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useReviewActions(STORY), { wrapper });

    await act(async () => {
      await result.current.approveReview.mutateAsync();
    });

    // Approval is exactly what flips `publication.publish` from denied to allowed, and the UI gates
    // on the map — so a stale map leaves the writer looking at a page that cannot publish.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.stories.capabilities(STORY) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.stories.review(STORY) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.stories.history(STORY) });
  });
});

describe('isNotApproved', () => {
  it('recognises the blocked-publish code and nothing else', () => {
    expect(
      isNotApproved(
        new ApiError(409, { code: ERROR_CODES.PUBLICATION_NOT_APPROVED, message: 'no' }),
      ),
    ).toBe(true);
    expect(
      isNotApproved(new ApiError(409, { code: 'PIECE_ALREADY_PUBLISHED', message: 'no' })),
    ).toBe(false);
    expect(isNotApproved(new Error('nope'))).toBe(false);
  });
});
