import { AiFeature } from '@qalam/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { get } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

import { useAiAvailability } from './use-ai-availability';

vi.mock('@/lib/api-client', () => ({ get: vi.fn() }));

/** A fresh client per test — retries off so a rejected read settles immediately. */
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const FEATURES = {
  aiEnabled: true,
  features: [{ feature: AiFeature.SemanticSearch, flagKey: 'x', enabled: true }],
};
const USAGE = { daily: { tokenLimit: 100, usedFraction: 0.1 }, monthly: null, total: null };

/**
 * The one AI gate read, and specifically **what it does without a session** (W5).
 *
 * This hook moved to app level in W5 so `features/search` and `features/reading` could share it — and
 * that put it on two PUBLIC pages for the first time. Its two endpoints are authenticated, and a 401
 * outside `/auth/*` is terminal to the api client: it ends the session and clears the query cache. On
 * `/p/:slug` that discarded the piece the reader came for, so a signed-out reading page never rendered
 * (docs/48 §3.9). These tests pin the fix at its source — no session, no request.
 */
describe('useAiAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'anonymous', role: null, isEmailVerified: null });
  });

  it('resolves signed-out WITHOUT touching either endpoint when there is no session', async () => {
    const { result } = renderHook(() => useAiAvailability(AiFeature.SemanticSearch), {
      wrapper: wrapper(),
    });

    expect(result.current).toBe('signed-out');
    // The assertion that matters: not merely the returned state, but that nothing was asked. A gate
    // read here 401s, and the 401 — not the answer — is what broke the public reading page.
    await waitFor(() => {
      expect(get).not.toHaveBeenCalled();
    });
  });

  it('stays signed-out while the session is still unknown (boot refresh in flight)', () => {
    useAuthStore.setState({ status: 'unknown', role: null, isEmailVerified: null });
    const { result } = renderHook(() => useAiAvailability(AiFeature.SemanticSearch), {
      wrapper: wrapper(),
    });

    // `unknown` means the boot refresh has not answered yet. Firing the reads then would 401 for
    // exactly the anonymous visitors this guards, so the requests wait for a real session.
    expect(result.current).toBe('signed-out');
    expect(get).not.toHaveBeenCalled();
  });

  it('reads both endpoints and resolves the feature once authenticated', async () => {
    useAuthStore.setState({ status: 'authenticated', role: 'user', isEmailVerified: true });
    vi.mocked(get).mockImplementation((path: string) =>
      Promise.resolve(path === '/ai/features' ? FEATURES : USAGE),
    );

    const { result } = renderHook(() => useAiAvailability(AiFeature.SemanticSearch), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      expect(result.current).toBe('available');
    });
    expect(get).toHaveBeenCalledWith('/ai/features', expect.anything());
    expect(get).toHaveBeenCalledWith('/ai/usage/me', expect.anything());
  });
});
