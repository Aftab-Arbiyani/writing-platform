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
 * The odd one out among the four history lists.
 *
 * `GET /monetization/subscription/history` answers **404 SUBSCRIPTION_NOT_FOUND** for a viewer with no
 * subscription, where invoices / payments / purchases all answer an empty page (verified live —
 * `SubscriptionService.listHistory` loads the subscription first and throws). Every free reader who
 * opens billing history would otherwise meet an error panel on a tab whose truthful content is
 * "nothing has happened yet". Recorded as a backend defect (docs/48 §3.6, W4-1); mapped here so the
 * surface is honest in the meantime.
 */
describe('useSubscriptionHistory — the 404 asymmetry', () => {
  it('maps SUBSCRIPTION_NOT_FOUND to an empty page', async () => {
    history.mockRejectedValue(
      new ApiError(404, {
        code: ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
        message: 'No subscription found.',
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useSubscriptionHistory(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.pages[0]?.items).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('still errors on any other failure', async () => {
    // The mapping is confined to one code so a genuine problem is not hidden behind "nothing yet".
    history.mockRejectedValue(
      new ApiError(500, { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message: 'boom' }),
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
