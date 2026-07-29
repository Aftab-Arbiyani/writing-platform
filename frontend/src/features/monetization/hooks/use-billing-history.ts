import { useInfiniteQuery } from '@tanstack/react-query';

import { type CursorPage } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

import { monetizationApi } from '../api/monetization.api';
import { isMonetizationEnabled } from '../lib/monetization-enabled';

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
 * Plain, like its three siblings. It used to carry a `SUBSCRIPTION_NOT_FOUND` → empty-page mapping,
 * because the endpoint 404'd for a viewer with no subscription where the other three answered
 * `data: []` — W4 added that as a stated workaround and W4-1 fixed the endpoint instead
 * (`SubscriptionService.listHistory` now scopes by `user_id`, so all four ledgers behave alike). The
 * workaround is gone with it: a client is the wrong place for one of four identical lists to be
 * special-cased, and leaving dead compensation behind hides the fix from the next reader.
 */
export function useSubscriptionHistory() {
  return useInfiniteQuery({
    queryKey: qk.monetization.subscriptionHistory(),
    queryFn: ({ pageParam }) =>
      monetizationApi.subscriptionHistory(pageParam ?? undefined, HISTORY_PAGE),
    initialPageParam: null as string | null,
    getNextPageParam: nextCursor,
    enabled: isMonetizationEnabled(),
    staleTime: HISTORY_STALE,
  });
}
