import { EntitlementReason, EntitlementStatus, PlanTier, PremiumFeature } from '@qalam/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { STORAGE_KEYS } from '@/lib/constants';

import {
  FREE_SNAPSHOT,
  clearCachedEntitlements,
  readCachedEntitlements,
  writeCachedEntitlements,
} from './entitlement-cache';
import { allows } from './entitlement-decisions';
import type { EntitlementSnapshot } from '../types/monetization.types';

const SNAPSHOT: EntitlementSnapshot = {
  tier: PlanTier.Pro,
  status: EntitlementStatus.Allow,
  features: [
    {
      feature: PremiumFeature.AiWriting,
      status: EntitlementStatus.Allow,
      allowed: true,
      reason: EntitlementReason.PlanIncludes,
      expiresAt: null,
      remaining: null,
      limit: null,
    },
  ],
  refreshAt: null,
};

describe('entitlement cache', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips a snapshot', () => {
    writeCachedEntitlements(SNAPSHOT);
    expect(readCachedEntitlements()).toEqual(SNAPSHOT);
  });

  it('uses the registered storage key, so sign-out can clear it without importing this feature', () => {
    // `use-logout` removes `STORAGE_KEYS.entitlements` by key precisely because a feature may not
    // import another feature. If this key drifts from the registry, sign-out silently stops working.
    writeCachedEntitlements(SNAPSHOT);
    expect(window.localStorage.getItem(STORAGE_KEYS.entitlements)).not.toBeNull();
  });

  it('returns null when nothing is cached', () => {
    expect(readCachedEntitlements()).toBeNull();
  });

  it('returns null for unparseable storage', () => {
    window.localStorage.setItem(STORAGE_KEYS.entitlements, '{not json');
    expect(readCachedEntitlements()).toBeNull();
  });

  it('returns null for a wrong-shaped value rather than handing it to a gate', () => {
    // Anything on the origin can write here, and an older app version may have left a different
    // shape. Neither may reach a render as `undefined.map`.
    window.localStorage.setItem(STORAGE_KEYS.entitlements, JSON.stringify({ tier: 'pro' }));
    expect(readCachedEntitlements()).toBeNull();

    window.localStorage.setItem(STORAGE_KEYS.entitlements, JSON.stringify(['pro']));
    expect(readCachedEntitlements()).toBeNull();

    window.localStorage.setItem(STORAGE_KEYS.entitlements, JSON.stringify(null));
    expect(readCachedEntitlements()).toBeNull();
  });

  it('clears', () => {
    writeCachedEntitlements(SNAPSHOT);
    clearCachedEntitlements();
    expect(readCachedEntitlements()).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    // Private browsing / storage full. `lib/storage` swallows, and the fallback chain treats a failed
    // read as "no cache" — which denies, which is the safe direction.
    const original = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error('SecurityError');
    };
    expect(() => readCachedEntitlements()).not.toThrow();
    expect(readCachedEntitlements()).toBeNull();
    window.localStorage.getItem = original;
  });
});

describe('FREE_SNAPSHOT — the floor', () => {
  it('denies every premium feature', () => {
    // The value used when nothing is known. Everything in the catalogue must deny, or "we couldn't
    // reach the server" would silently grant premium UI.
    for (const feature of Object.values(PremiumFeature)) {
      expect(allows(FREE_SNAPSHOT, feature)).toBe(false);
    }
  });

  it('is the free tier', () => {
    expect(FREE_SNAPSHOT.tier).toBe(PlanTier.Free);
  });
});
