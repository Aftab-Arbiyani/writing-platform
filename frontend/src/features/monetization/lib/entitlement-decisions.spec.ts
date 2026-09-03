import { EntitlementReason, EntitlementStatus, PlanTier, PremiumFeature } from '@qalam/shared';
import { describe, expect, it } from 'vitest';

import {
  allows,
  decisionFor,
  isPremium,
  isQuotaDenial,
  isTimeBounded,
} from './entitlement-decisions';
import type { EntitlementDecision, EntitlementSnapshot } from '../types/monetization.types';

function decision(over: Partial<EntitlementDecision> = {}): EntitlementDecision {
  return {
    feature: PremiumFeature.AiWriting,
    status: EntitlementStatus.Allow,
    allowed: true,
    reason: EntitlementReason.PlanIncludes,
    expiresAt: null,
    remaining: null,
    limit: null,
    ...over,
  };
}

function snapshot(over: Partial<EntitlementSnapshot> = {}): EntitlementSnapshot {
  return {
    tier: PlanTier.Free,
    status: EntitlementStatus.Allow,
    features: [],
    refreshAt: null,
    ...over,
  };
}

/**
 * These are the reads every gate depends on, and the property that matters most is that all three
 * "we don't know" paths land on deny. Getting that backwards shows a control the server then refuses,
 * which reads as a broken app (the W3c-1 failure mode).
 */
describe('decisionFor — the absent case', () => {
  it('synthesises a deny when the snapshot does not mention the feature', () => {
    // The normal free-tier shape: the server lists what it evaluated, and an unlisted feature has no
    // grant behind it.
    const result = decisionFor(snapshot(), PremiumFeature.AiWriting);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(EntitlementStatus.Deny);
    expect(result.reason).toBe(EntitlementReason.PlanExcludes);
  });

  it('synthesises a deny when there is no snapshot at all', () => {
    // Loading, errored, offline with no cache, or the client flag off — all arrive here.
    expect(decisionFor(undefined, PremiumFeature.AiWriting).allowed).toBe(false);
  });

  it('returns the server’s decision verbatim when present', () => {
    const server = decision({ feature: PremiumFeature.AiWriting, remaining: 42, limit: 100 });
    const result = decisionFor(snapshot({ features: [server] }), PremiumFeature.AiWriting);
    expect(result).toBe(server);
  });
});

describe('allows', () => {
  it('reads the server’s `allowed` flag rather than re-deriving it from `status`', () => {
    // The server computes `allowed` from plan + overrides + time boundaries + quota. If it ever
    // disagrees with a client-side reading of `status`, the server is right by definition — so this
    // must follow the boolean even when the pair looks contradictory.
    const contradictory = decision({
      feature: PremiumFeature.AiWriting,
      status: EntitlementStatus.Allow,
      allowed: false,
    });
    expect(allows(snapshot({ features: [contradictory] }), PremiumFeature.AiWriting)).toBe(false);
  });

  it('allows a limited decision — a quota is access, not a denial', () => {
    const limited = decision({
      feature: PremiumFeature.AiWriting,
      status: EntitlementStatus.Limited,
      allowed: true,
      remaining: 5,
      limit: 100,
    });
    expect(allows(snapshot({ features: [limited] }), PremiumFeature.AiWriting)).toBe(true);
  });

  it('denies an unknown feature string', () => {
    // `GET /entitlements/:feature` accepts any string and denies what it doesn't recognise, so a typo
    // is indistinguishable from a genuine denial — fail closed either way.
    expect(allows(snapshot(), 'not_a_real_feature')).toBe(false);
  });
});

describe('isPremium', () => {
  it('is false on free and true on every paid tier', () => {
    expect(isPremium(snapshot({ tier: PlanTier.Free }))).toBe(false);
    expect(isPremium(snapshot({ tier: PlanTier.Plus }))).toBe(true);
    expect(isPremium(snapshot({ tier: PlanTier.Pro }))).toBe(true);
    expect(isPremium(snapshot({ tier: PlanTier.Enterprise }))).toBe(true);
  });

  it('is false with no snapshot', () => {
    expect(isPremium(undefined)).toBe(false);
  });
});

describe('isTimeBounded', () => {
  it('is true for a trial and a grace period, false for a plain allow', () => {
    expect(isTimeBounded(decision({ status: EntitlementStatus.Trial }))).toBe(true);
    expect(isTimeBounded(decision({ status: EntitlementStatus.GracePeriod }))).toBe(true);
    expect(isTimeBounded(decision({ status: EntitlementStatus.Allow }))).toBe(false);
    expect(isTimeBounded(decision({ status: EntitlementStatus.Limited }))).toBe(false);
  });
});

describe('isQuotaDenial', () => {
  it('separates a spent allowance from a missing plan', () => {
    // The whole remedy hangs on this: quota resets on its own, plan_excludes never does. A gate that
    // offers "See plans" to someone who only has to wait until tomorrow is selling them nothing.
    expect(isQuotaDenial(decision({ reason: EntitlementReason.QuotaExceeded }))).toBe(true);
    expect(isQuotaDenial(decision({ reason: EntitlementReason.PlanExcludes }))).toBe(false);
    expect(isQuotaDenial(decision({ reason: EntitlementReason.NoSubscription }))).toBe(false);
    expect(isQuotaDenial(decision({ reason: EntitlementReason.Suspended }))).toBe(false);
  });
});
