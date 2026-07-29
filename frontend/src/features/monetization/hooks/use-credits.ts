import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { monetizationApi } from '../api/monetization.api';
import { isMonetizationEnabled } from '../lib/monetization-enabled';

/** Live tier: the balance falls with every metered AI request (docs/12 §2.2). */
const CREDITS_STALE = 30 * 1000;
const LEDGER_PAGE = 20;

/** The AI credit wallet (AF5, W4). The first read creates the wallet server-side. */
export function useCreditBalance() {
  return useQuery({
    queryKey: qk.monetization.credits(),
    queryFn: ({ signal }) => monetizationApi.credits(signal),
    enabled: isMonetizationEnabled(),
    staleTime: CREDITS_STALE,
  });
}

/**
 * The credit ledger, newest first (AF5, W4).
 *
 * Infinite rather than a fixed first page — mobile's `creditLedger` takes only page one, which is fine
 * on a phone that never offered a "load more". The web has room for the whole history, and the ledger
 * is the only audit trail a reader has for where their credits went: every debit carries the feature
 * that spent it, the tokens it bought and its USD cost.
 *
 * The cursor is opaque and lives in `pageParam`, never in the query key (docs/12 §2.1).
 */
export function useCreditLedger() {
  return useInfiniteQuery({
    queryKey: qk.monetization.creditTransactions(),
    queryFn: ({ pageParam }) =>
      monetizationApi.creditTransactions(pageParam ?? undefined, LEDGER_PAGE),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.meta.hasMore ? lastPage.meta.nextCursor : null),
    enabled: isMonetizationEnabled(),
    staleTime: CREDITS_STALE,
  });
}
