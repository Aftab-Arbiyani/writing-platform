import { STORAGE_KEYS } from '@/lib/constants';
import { local } from '@/lib/storage';

import type { EntitlementSnapshot } from '../types/monetization.types';

/**
 * The last server-authoritative entitlement snapshot, kept in `localStorage` (AF5, W4).
 *
 * Ported from mobile's `entitlement_cache_store.dart`, which is the reference for the staleness
 * semantics — and they are unusual enough to state plainly, because "cache" understates how weak a
 * claim this makes:
 *
 * - **A fresh server response always wins, unconditionally.** This is written on every successful
 *   read and is never merged with, preferred over, or reconciled against one.
 * - **It is read only when the server could not be reached.** Not on a 402, not on a 403 — those are
 *   answers. Only a transport failure falls back here, which is why a revoked entitlement cannot be
 *   resurrected by going offline: the server refuses the action regardless.
 * - **There is no TTL, and the snapshot's own `refreshAt` is not enforced here.** A TTL would imply
 *   this data expires into correctness, and it does not: a stale snapshot is exactly as
 *   non-authoritative one second after it was written as it is a week later. `refreshAt` is the
 *   server's hint about when the *answer* changes (period end, trial end) and belongs to the query
 *   layer's refetch decision, not to whether this copy may be shown.
 * - **The floor is deny.** No entry, unreadable entry, or wrong-shaped entry → the caller uses the
 *   free-tier default, where every premium feature is denied. Gating fails closed; the free product
 *   keeps working.
 *
 * So this exists for exactly one job: an offline reader should see the plan badge and the gates they
 * saw a moment ago, rather than the app forgetting who they are. It is a UX smoothing device, and it
 * is never a security boundary.
 *
 * Not a TanStack persister: this is one small value with bespoke fallback rules, and persisting the
 * whole query cache to reach it would drag every other cached query along for the ride.
 *
 * The key lives in `lib/constants.ts` with the app's other `localStorage` keys, not here — which is
 * also what lets sign-out clear it without `features/auth` importing this feature (docs/26 §4).
 */
const KEY = STORAGE_KEYS.entitlements;

/** The snapshot the app assumes when it knows nothing: free tier, every premium feature denied. */
export const FREE_SNAPSHOT: EntitlementSnapshot = {
  tier: 'free',
  status: 'allow',
  features: [],
  refreshAt: null,
};

/**
 * Whether a parsed value is shaped like a snapshot.
 *
 * Storage is attacker-writable in the sense that anything on the origin can put junk there, and a
 * previous app version may have written an older shape. Neither may crash a render, and neither may
 * be *trusted* — but note that trust is not the question a shape check answers: a forged snapshot
 * claiming `enterprise` would pass this and still buy nothing, because the server is asked before
 * anything happens. This check is about not rendering `undefined.map`.
 */
function isSnapshot(value: unknown): value is EntitlementSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<EntitlementSnapshot>;
  return typeof candidate.tier === 'string' && Array.isArray(candidate.features);
}

/** The cached snapshot, or `null` when there is nothing trustworthy to render. */
export function readCachedEntitlements(): EntitlementSnapshot | null {
  const raw = local.get<unknown>(KEY, null);
  return isSnapshot(raw) ? raw : null;
}

/** Record a snapshot the server just answered. Called on every successful read. */
export function writeCachedEntitlements(snapshot: EntitlementSnapshot): void {
  local.set(KEY, snapshot);
}

/**
 * Drop the cached snapshot.
 *
 * Called on sign-out: entitlements are per-user, and the next account to use this browser must not
 * inherit the last one's plan badge for the moment before its own snapshot arrives.
 */
export function clearCachedEntitlements(): void {
  local.remove(KEY);
}
