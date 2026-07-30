import { useQuery } from '@tanstack/react-query';

import { ApiError } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

import { monetizationApi } from '../api/monetization.api';
import {
  FREE_SNAPSHOT,
  readCachedEntitlements,
  writeCachedEntitlements,
} from '../lib/entitlement-cache';
import { allows, decisionFor, isPremium } from '../lib/entitlement-decisions';
import { isMonetizationEnabled } from '../lib/monetization-enabled';
import type {
  EntitlementDecision,
  EntitlementSnapshot,
  PremiumFeature,
} from '../types/monetization.types';

/**
 * The entitlement snapshot (AF5, W4) — the ONE thing premium UI gates on.
 *
 * **60 seconds, matching the server's own decision cache** (`ENTITLEMENT_CACHE_TTL_SECONDS`).
 * Holding a longer copy client-side would show affordances the server has already stopped honouring;
 * holding a shorter one would ask a question whose answer is memoized anyway. The same reasoning
 * W3a applied to the capability map, against the same kind of server-side TTL.
 */
const ENTITLEMENTS_STALE = 60 * 1000;

/**
 * Reads the whole snapshot in one request, writing every success to the local cache.
 *
 * **The fallback chain is cached snapshot → free-tier default, and only a TRANSPORT failure enters
 * it.** `error.status === 0` is the api-client's offline / network / unreachable class, and it is the
 * only failure that means "we don't know" rather than "here is your answer". A 403 — which is exactly
 * what a withheld `billing.use` looks like, the PBAC seed-grant defect fixed in de61316 — is an
 * answer, and it errors so the billing surfaces can say "we couldn't load your plan" instead of
 * looking like a healthy free account. So does a 401, which the api-client's session handling needs to
 * see. A cancelled request (`AbortError`, not an `ApiError`) rethrows untouched.
 *
 * `placeholderData` is a separate concern from that fallback and cannot substitute for it: TanStack
 * serves placeholder data only while a query is *pending*, and drops it the moment the query errors.
 * It buys the instant first paint; the catch below is what survives going offline.
 *
 * Either way, failing to reach the server can only ever *withhold* premium UI, never grant it: with no
 * cache, `data` stays undefined and every reader treats that as the free tier, where all premium
 * features deny. And the server re-checks every premium action regardless, answering 402 to anything a
 * stale hint got wrong.
 */
export function useEntitlements() {
  return useQuery({
    queryKey: qk.monetization.entitlements(),
    queryFn: async ({ signal }): Promise<EntitlementSnapshot> => {
      try {
        const snapshot = await monetizationApi.entitlements(signal);
        writeCachedEntitlements(snapshot);
        return snapshot;
      } catch (error) {
        const cached = readCachedEntitlements();
        if (error instanceof ApiError && error.status === 0 && cached !== null) return cached;
        throw error;
      }
    },
    // Only offered while the client switch is on; every gate then reads the free-tier default, which
    // denies. A dark client must not issue twenty requests per page for answers it will not use.
    enabled: isMonetizationEnabled(),
    staleTime: ENTITLEMENTS_STALE,
    // The value form, not the callback form: the callback's type parameter is what TanStack infers
    // `TQueryFnData` from, so a callback returning `EntitlementSnapshot | undefined` widens the whole
    // query's data type. Reading `localStorage` once per render is cheaper than that inference.
    placeholderData: readCachedEntitlements() ?? undefined,
  });
}

/** What a gate gets back: the resolved answer plus the state that produced it. */
export interface EntitlementVerdict {
  /** True ONLY when the server said so. Loading, errored, absent, and disabled all read as false. */
  allowed: boolean;
  /** The full decision — status, reason, expiry, remaining quota — for copy that explains itself. */
  decision: EntitlementDecision;
  /** True while the snapshot is in flight and nothing is cached; render as pending, not as denied. */
  isPending: boolean;
  /** The viewer's tier, for badges and upsell copy. */
  tier: EntitlementSnapshot['tier'];
  /** True when the viewer is on any paid tier. */
  isPremium: boolean;
}

/**
 * One feature's verdict, resolved from the snapshot.
 *
 * Deliberately does NOT call `GET /entitlements/:feature`. The snapshot answers every feature in one
 * request, so a per-feature query would issue N requests for data already in the cache — and the
 * single-feature route exists for callers with no snapshot in scope, which a React tree under one
 * QueryClient never is.
 */
export function useEntitlement(feature: PremiumFeature | string): EntitlementVerdict {
  const { data, isLoading } = useEntitlements();
  const snapshot = data ?? (isMonetizationEnabled() ? undefined : FREE_SNAPSHOT);

  return {
    allowed: allows(snapshot, feature),
    decision: decisionFor(snapshot, feature),
    isPending: isLoading && snapshot === undefined,
    tier: snapshot?.tier ?? FREE_SNAPSHOT.tier,
    isPremium: isPremium(snapshot),
  };
}
