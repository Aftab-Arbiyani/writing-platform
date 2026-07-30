import { RestrictionType, TrustStatus } from '@qalam/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { trustApi } from '../api/trust.api';
import type { TrustSummary, UserRestriction } from '../types/collaboration.types';

/**
 * The viewer's own trust standing and their personal block/mute list (AF6, W3c — docs/49 §5).
 *
 * The standing read is what the restricted-state wall renders from, alongside the capabilities map.
 * The server enforces regardless — every write re-checks through the Policy Engine — so this is
 * explanation, never enforcement.
 */
const TRUST_STALE = 60 * 1000;

/** `GET /me/trust`. */
export function useMyTrust(enabled = true) {
  return useQuery({
    queryKey: qk.trust.me(),
    queryFn: ({ signal }) => trustApi.me(signal),
    enabled,
    staleTime: TRUST_STALE,
  });
}

/** `GET /me/blocks` — blocks and mutes together, distinguished by `kind`. */
export function useMyBlocks(enabled = true) {
  return useQuery({
    queryKey: qk.trust.blocks(),
    queryFn: ({ signal }) => trustApi.blocks(signal),
    enabled,
    staleTime: TRUST_STALE,
  });
}

/**
 * Block / unblock / mute / unmute.
 *
 * Each takes the **user's** id. Passing a block row's `id` is defect T-1, which made unblocking
 * impossible on mobile — both are UUIDs, so the wrong one reaches the service and 404s.
 *
 * Blocking severs interaction both ways, which changes what the viewer's feed and any story roster
 * may show, so the whole trust namespace plus the feed go.
 */
export function useBlockActions() {
  const client = useQueryClient();

  const invalidate = async (): Promise<void> => {
    await Promise.all([
      client.invalidateQueries({ queryKey: qk.trust.all }),
      client.invalidateQueries({ queryKey: qk.feed.all }),
    ]);
  };

  // Each `mutationFn` forwards ONLY the user id. Passing `trustApi.block` directly would hand it
  // React Query's second argument (the mutation context) as well — harmless today, and exactly the
  // kind of accidental extra argument that becomes a bug the moment the api function grows a second
  // parameter.
  const block = useMutation({
    mutationFn: (userId: string) => trustApi.block(userId),
    onSuccess: invalidate,
  });
  const unblock = useMutation({
    mutationFn: (userId: string) => trustApi.unblock(userId),
    onSuccess: invalidate,
  });
  const mute = useMutation({
    mutationFn: (userId: string) => trustApi.mute(userId),
    onSuccess: invalidate,
  });
  const unmute = useMutation({
    mutationFn: (userId: string) => trustApi.unmute(userId),
    onSuccess: invalidate,
  });

  return { block, unblock, mute, unmute };
}

// ── Reading a standing ─────────────────────────────────────────────────────────────────────────
//
// Pure helpers over the summary, kept here so the wall and any future surface agree on what
// "restricted" means. They read BOTH the effective `status` and the `restrictions` rows: the status
// is what the Policy Engine sees, and a scoped restriction (e.g. publishing-only) can be in force
// while the global status still reads `normal`.

/** Restrictions still in force — `liftedAt` is how the wire says "no longer applies" (T-2). */
export function activeRestrictions(trust: TrustSummary | undefined): UserRestriction[] {
  return (trust?.restrictions ?? []).filter((restriction) => restriction.liftedAt === null);
}

function hasRestriction(trust: TrustSummary | undefined, type: RestrictionType): boolean {
  return activeRestrictions(trust).some((restriction) => restriction.type === type);
}

export function isSuspended(trust: TrustSummary | undefined): boolean {
  return (
    trust?.status === TrustStatus.Suspended ||
    trust?.status === TrustStatus.Banned ||
    hasRestriction(trust, RestrictionType.Suspended)
  );
}

export function isReadOnly(trust: TrustSummary | undefined): boolean {
  return trust?.status === TrustStatus.ReadOnly || hasRestriction(trust, RestrictionType.ReadOnly);
}

export function isMuted(trust: TrustSummary | undefined): boolean {
  return (
    trust?.status === TrustStatus.Muted ||
    trust?.status === TrustStatus.Shadowed ||
    hasRestriction(trust, RestrictionType.Muted) ||
    hasRestriction(trust, RestrictionType.Shadow)
  );
}

/**
 * Whether the viewer's account carries any live limitation.
 *
 * **Fails open on an absent summary.** `undefined` (loading, errored, or the flag is off) is treated
 * as good standing: telling someone in good standing that they are limited is worse than briefly not
 * telling someone who is, and the server refuses the write either way.
 */
export function isRestricted(trust: TrustSummary | undefined): boolean {
  if (trust === undefined) return false;
  const goodStanding = trust.status === TrustStatus.Trusted || trust.status === TrustStatus.Normal;
  return !goodStanding || activeRestrictions(trust).length > 0;
}
