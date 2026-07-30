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

/** The caller's AI usage (daily/monthly/lifetime + per feature). */
export function useAiUsage() {
  return useQuery({
    queryKey: qk.ai.usage(),
    queryFn: ({ signal }) => aiApi.usage(signal),
    staleTime: 30_000,
  });
}
