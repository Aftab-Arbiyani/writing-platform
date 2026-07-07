import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api-client';

/**
 * Single QueryClient for the app. Server state lives here ONLY — never mirrored
 * into Zustand (docs/00 §6). Caching/invalidation policy is documented in
 * docs/12_FrontendArchitecture.md; per-feature hooks override per query where
 * the domain demands it (e.g. feeds want shorter staleTime).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // One retry for transient failures; 4xx responses are deterministic
      // (auth/validation/not-found) — retrying them only burns rate limit.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});
