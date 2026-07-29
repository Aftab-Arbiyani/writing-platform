import {
  EntitlementReason,
  EntitlementStatus,
  ERROR_CODES,
  PlanTier,
  PremiumFeature,
} from '@qalam/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { STORAGE_KEYS } from '@/lib/constants';

import { monetizationApi } from '../api/monetization.api';
import type { EntitlementSnapshot } from '../types/monetization.types';
import { useEntitlement, useEntitlements } from './use-entitlements';

vi.mock('../api/monetization.api');
vi.mock('../lib/monetization-enabled');

const { isMonetizationEnabled } = await import('../lib/monetization-enabled');
const enabled = vi.mocked(isMonetizationEnabled);
const entitlements = vi.mocked(monetizationApi.entitlements);

function snapshot(over: Partial<EntitlementSnapshot> = {}): EntitlementSnapshot {
  return {
    tier: PlanTier.Pro,
    status: EntitlementStatus.Allow,
    features: [
      {
        feature: PremiumFeature.AiBudget,
        status: EntitlementStatus.Allow,
        allowed: true,
        reason: EntitlementReason.PlanIncludes,
        expiresAt: null,
        remaining: null,
        limit: null,
      },
    ],
    refreshAt: null,
    ...over,
  };
}

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
  window.localStorage.clear();
  enabled.mockReturnValue(true);
});

describe('useEntitlements', () => {
  it('caches every successful snapshot to localStorage', async () => {
    // The cache exists so gating survives a reload and being offline. If the write is skipped, the
    // fallback below has nothing to fall back to.
    entitlements.mockResolvedValue(snapshot());
    const { wrapper } = setup();
    const { result } = renderHook(() => useEntitlements(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(window.localStorage.getItem(STORAGE_KEYS.entitlements)).not.toBeNull();
  });

  it('serves the cached snapshot as placeholder data while the read is in flight', async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.entitlements,
      JSON.stringify(snapshot({ tier: PlanTier.Plus })),
    );
    // A read that never settles — the placeholder is all there is.
    entitlements.mockReturnValue(new Promise(() => {}));
    const { wrapper } = setup();
    const { result } = renderHook(() => useEntitlements(), { wrapper });

    expect(result.current.data?.tier).toBe(PlanTier.Plus);
  });

  it('falls back to the cached snapshot when the transport fails', async () => {
    // The offline case mobile's provider was written for: going offline must not drop a viewer to the
    // free tier mid-session. `status: 0` is the api-client's offline/network class.
    //
    // This cannot be left to `placeholderData` — TanStack serves that only while a query is PENDING
    // and drops it once the query errors, so without the queryFn's own catch the snapshot vanishes at
    // exactly the moment it is needed.
    window.localStorage.setItem(
      STORAGE_KEYS.entitlements,
      JSON.stringify(snapshot({ tier: PlanTier.Pro })),
    );
    entitlements.mockRejectedValue(
      new ApiError(0, { code: 'API_OFFLINE', message: "You're offline." }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useEntitlements(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.tier).toBe(PlanTier.Pro);
    expect(result.current.isError).toBe(false);
  });

  it('errors on a transport failure with no cache — the floor is deny, not a guess', async () => {
    entitlements.mockRejectedValue(
      new ApiError(0, { code: 'API_OFFLINE', message: "You're offline." }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useEntitlements(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });

  it('does NOT use the cache for a 403 — that is an answer, not a lost connection', async () => {
    // A withheld `billing.use` (the PBAC seed-grant defect fixed in de61316) must not look like a
    // healthy premium account just because a stale snapshot happens to be on disk.
    window.localStorage.setItem(
      STORAGE_KEYS.entitlements,
      JSON.stringify(snapshot({ tier: PlanTier.Pro })),
    );
    entitlements.mockRejectedValue(
      new ApiError(403, { code: ERROR_CODES.AUTH_PERMISSION_DENIED, message: 'denied' }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useEntitlements(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('does not fetch while the client flag is off', async () => {
    enabled.mockReturnValue(false);
    const { wrapper } = setup();
    renderHook(() => useEntitlements(), { wrapper });
    await Promise.resolve();
    expect(entitlements).not.toHaveBeenCalled();
  });
});

/**
 * `useEntitlement` is what every gate calls, so the tests below are about the direction it fails in.
 * All three unknown states must deny.
 */
describe('useEntitlement', () => {
  it('reflects the server’s verdict for a granted feature', async () => {
    entitlements.mockResolvedValue(snapshot());
    const { wrapper } = setup();
    const { result } = renderHook(() => useEntitlement(PremiumFeature.AiBudget), { wrapper });

    await waitFor(() => {
      expect(result.current.allowed).toBe(true);
    });
    expect(result.current.tier).toBe(PlanTier.Pro);
    expect(result.current.isPremium).toBe(true);
  });

  it('denies a feature the snapshot does not grant', async () => {
    entitlements.mockResolvedValue(snapshot({ tier: PlanTier.Free, features: [] }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useEntitlement(PremiumFeature.AiWriting), { wrapper });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.allowed).toBe(false);
    expect(result.current.decision.reason).toBe(EntitlementReason.PlanExcludes);
  });

  it('denies — and does not report pending — while the flag is off', () => {
    // Reads the free-tier default synchronously rather than sitting in a permanent pending state,
    // which would leave an `optimistic` gate rendering premium content forever.
    enabled.mockReturnValue(false);
    const { wrapper } = setup();
    const { result } = renderHook(() => useEntitlement(PremiumFeature.AiBudget), { wrapper });

    expect(result.current.allowed).toBe(false);
    expect(result.current.isPending).toBe(false);
    expect(result.current.tier).toBe(PlanTier.Free);
  });

  it('reports pending while the first read is in flight with no cache', () => {
    entitlements.mockReturnValue(new Promise(() => {}));
    const { wrapper } = setup();
    const { result } = renderHook(() => useEntitlement(PremiumFeature.AiBudget), { wrapper });

    expect(result.current.isPending).toBe(true);
    expect(result.current.allowed).toBe(false);
  });

  it('carries the quota detail a limited decision comes with', async () => {
    entitlements.mockResolvedValue(
      snapshot({
        features: [
          {
            feature: PremiumFeature.AiBudget,
            status: EntitlementStatus.Limited,
            allowed: true,
            reason: EntitlementReason.PlanIncludes,
            expiresAt: null,
            remaining: 1_200,
            limit: 20_000,
          },
        ],
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useEntitlement(PremiumFeature.AiBudget), { wrapper });

    await waitFor(() => {
      expect(result.current.allowed).toBe(true);
    });
    expect(result.current.decision.remaining).toBe(1_200);
    expect(result.current.decision.limit).toBe(20_000);
  });
});
