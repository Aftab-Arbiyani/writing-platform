import { ERROR_CODES } from '@qalam/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';

import { monetizationApi } from '../api/monetization.api';
import { useInvoices, useSubscriptionHistory } from './use-billing-history';

vi.mock('../api/monetization.api');
vi.mock('../lib/monetization-enabled');

const { isMonetizationEnabled } = await import('../lib/monetization-enabled');
const enabled = vi.mocked(isMonetizationEnabled);
const history = vi.mocked(monetizationApi.subscriptionHistory);
const invoices = vi.mocked(monetizationApi.invoices);

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
  return { wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  enabled.mockReturnValue(true);
});

/**
 * The four ledgers behave alike, which is the property W4-1 restored.
 *
 * `subscription/history` used to 404 `SUBSCRIPTION_NOT_FOUND` for a viewer with no subscription while
 * its three siblings answered an empty page, and this hook carried a mapping to compensate. The service
 * now scopes by `user_id` (docs/48 §3.6, W4-1), so the mapping is gone — and these tests pin the
 * consequence: the hook must be plain, and a 404 must NOT be quietly swallowed any more.
 */
describe('useSubscriptionHistory', () => {
  it('pages a real history like any other ledger', async () => {
    history.mockResolvedValue({
      items: [
        {
          id: 'evt-1',
          type: 'activated',
          fromTier: null,
          toTier: 'plus',
          fromStatus: null,
          toStatus: 'active',
          createdAt: new Date().toISOString(),
        },
      ],
      meta: { nextCursor: null, hasMore: false },
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useSubscriptionHistory(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.pages[0]?.items).toHaveLength(1);
  });

  it('surfaces a 404 as an error rather than hiding it', async () => {
    // The inverse of the old behaviour, asserted on purpose. If the endpoint ever regresses to 404ing
    // for a free viewer, this fails — which is what should happen, rather than a client silently
    // absorbing it again and the regression going unnoticed on both platforms.
    history.mockRejectedValue(
      new ApiError(404, {
        code: ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
        message: 'No subscription found.',
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useSubscriptionHistory(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('cursor pagination', () => {
  it('follows nextCursor only while hasMore is set', async () => {
    // `nextCursor` is opaque and rides in `pageParam`, never in the query key (docs/12 §2.1).
    invoices.mockResolvedValue({
      items: [],
      meta: { nextCursor: 'cursor-2', hasMore: true },
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useInvoices(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();
    await waitFor(() => {
      expect(invoices).toHaveBeenCalledWith('cursor-2', 20);
    });
  });

  it('stops when the server says there is no more, even if a cursor is present', async () => {
    // `hasMore: false` with a non-null cursor is the shape the pagination helper can emit; trusting the
    // cursor alone would loop forever.
    invoices.mockResolvedValue({
      items: [],
      meta: { nextCursor: 'cursor-2', hasMore: false },
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useInvoices(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.hasNextPage).toBe(false);
  });
});
