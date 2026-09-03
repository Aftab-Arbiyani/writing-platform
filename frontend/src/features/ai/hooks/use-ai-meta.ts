import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { aiApi } from '../api/ai.api';

/** Which AI features are enabled for the caller (master + per-feature flags). */
export function useAiFeatures() {
  return useQuery({
    queryKey: qk.ai.features(),
    queryFn: ({ signal }) => aiApi.features(signal),
    staleTime: 60_000,
  });
}

/** The registered AI models the caller can select. */
export function useAiModels() {
  return useQuery({
    queryKey: qk.ai.models(),
    queryFn: ({ signal }) => aiApi.models(signal),
    staleTime: 5 * 60_000,
  });
}

// D5 removed `useAiUsage`. It read `GET /ai/usage/me` for a token rollup — a route that no longer
// exists (B2) and a unit no writer was ever asked to think in. The allowance a writer actually has
// is a per-tool action count from `GET /monetization/usage`; see `useFeatureAllowances`.
