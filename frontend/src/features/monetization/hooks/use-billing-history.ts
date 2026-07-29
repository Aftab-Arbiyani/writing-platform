import { ERROR_CODES } from '@qalam/shared';
import { useInfiniteQuery } from '@tanstack/react-query';

import { ApiError, type CursorPage } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

import { monetizationApi } from '../api/monetization.api';
import { isMonetizationEnabled } from '../lib/monetization-enabled';
import type { SubscriptionEventResponse } from '../types/monetization.types';

/**
 * Billing history (AF5, W4) — invoices, payments, purchases, and subscription events.
 *
 * All four are append-only ledgers: a row, once written, never changes. So the stale time is long —
 * there is nothing to go stale *into*, only new rows to arrive, and those arrive on a refetch.
 */
const HISTORY_STALE = 5 * 60 * 1000;
const HISTORY_PAGE = 20;

const nextCursor = (page: CursorPage<unknown>): string | null =>
  page.meta.hasMore ? page.meta.nextCursor : null;

export function useInvoices() {
  return useInfiniteQuery({
    queryKey: qk.monetization.invoices(),
    queryFn: ({ pageParam }) => monetizationApi.invoices(pageParam ?? undefined, HISTORY_PAGE),
    initialPageParam: null as string | null,
    getNextPageParam: nextCursor,
    enabled: isMonetizationEnabled(),
    staleTime: HISTORY_STALE,
  });
}

export function usePayments() {
  return useInfiniteQuery({
    queryKey: qk.monetization.payments(),
    queryFn: ({ pageParam }) => monetizationApi.payments(pageParam ?? undefined, HISTORY_PAGE),
    initialPageParam: null as string | null,
    getNextPageParam: nextCursor,
    enabled: isMonetizationEnabled(),
    staleTime: HISTORY_STALE,
  });
}

export function usePurchases() {
  return useInfiniteQuery({
    queryKey: qk.monetization.purchases(),
    queryFn: ({ pageParam }) => monetizationApi.purchases(pageParam ?? undefined, HISTORY_PAGE),
    initialPageParam: null as string | null,
    getNextPageParam: nextCursor,
    enabled: isMonetizationEnabled(),
    staleTime: HISTORY_STALE,
  });
}

/**
 * Subscription lifecycle history (AF5, W4).
 *
 * **`SUBSCRIPTION_NOT_FOUND` is mapped to an empty page**, because this route breaks the pattern the
 * other three follow: a viewer with no subscription gets a 404 rather than `data: []` (verified live —
 * `SubscriptionService.listHistory` loads the subscription first and throws if there is none). Every
 * free reader who opens billing history would otherwise see an error panel on a tab whose truthful
 * content is "nothing has happened yet".
 *
 * The mapping is confined to this one code so a real failure still errors. The asymmetry itself is a
 * backend defect and is recorded rather than fixed here (docs/48 §3.6, W4-1) — a client should not be
 * the place where one of four sibling list endpoints gets its shape corrected.
 */
export function useSubscriptionHistory() {
  return useInfiniteQuery({
    queryKey: qk.monetization.subscriptionHistory(),
    queryFn: async ({ pageParam }): Promise<CursorPage<SubscriptionEventResponse>> => {
      try {
        return await monetizationApi.subscriptionHistory(pageParam ?? undefined, HISTORY_PAGE);
      } catch (error) {
        if (error instanceof ApiError && error.code === ERROR_CODES.SUBSCRIPTION_NOT_FOUND) {
          return { items: [], meta: { nextCursor: null, hasMore: false } };
        }
        throw error;
      }
    },
    initialPageParam: null as string | null,
    getNextPageParam: nextCursor,
    enabled: isMonetizationEnabled(),
    staleTime: HISTORY_STALE,
  });
}
