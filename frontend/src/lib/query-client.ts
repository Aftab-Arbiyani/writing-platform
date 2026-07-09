import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api-client';

/**
 * Single QueryClient. Server state lives here ONLY — never mirrored into Zustand
 * (docs/00 §6, docs/12 §1). Per-feature hooks set `staleTime` per data-class tier
 * (Live 30s / Content 5m / Identity 1m / Taxonomy 1h — docs/12 §2.2); these are the
 * conservative defaults.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // ≥ 15 min so Back-navigation renders instantly from cache (docs/11 §7, docs/12 §2.2).
      gcTime: 15 * 60_000,
      // 2 retries with backoff, but NEVER on 4xx (deterministic: auth/validation/not-found).
      // 401 handling is the api-client interceptor's job, not retry's (docs/12 §2.6).
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 3000),
      // Live-tier hooks opt into focus refetch individually; off globally to avoid churn.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      // Mutations never auto-retry by default; only Idempotency-Key'd publish may (docs/12 §2.6).
      retry: 0,
    },
  },
});
